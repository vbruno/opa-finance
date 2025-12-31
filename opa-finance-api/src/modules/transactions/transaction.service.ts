// src/modules/transactions/transaction.service.ts
import { and, asc, desc, eq, gte, ilike, lte, sql, sum } from "drizzle-orm";
import { FastifyInstance } from "fastify";

import { TransactionType } from "./transaction.enums";
import type {
  CreateTransactionInput,
  UpdateTransactionInput,
  ListTransactionsQuery,
  SummaryTransactionsQuery,
} from "./transaction.schemas";
import {
  NotFoundProblem,
  ForbiddenProblem,
  ConflictProblem,
  ValidationProblem,
} from "@/core/errors/problems";

import { accounts, categories, subcategories, transactions } from "@/db/schema";
export class TransactionService {
  constructor(private app: FastifyInstance) {}

  private unaccentAvailable?: boolean;

  private async hasUnaccent() {
    if (this.unaccentAvailable !== undefined) return this.unaccentAvailable;

    try {
      const result = await this.app.db.execute(
        sql`select 1 from pg_extension where extname = 'unaccent'`,
      );
      const rows = (result as { rows?: unknown[] }).rows ?? [];
      this.unaccentAvailable = rows.length > 0;
    } catch {
      this.unaccentAvailable = false;
    }

    return this.unaccentAvailable;
  }

  /* -------------------------------------------------------------------------- */
  /*                               VALIDADORES                                   */
  /* -------------------------------------------------------------------------- */

  private async validateAccount(userId: string, accountId: string) {
    const [acc] = await this.app.db.select().from(accounts).where(eq(accounts.id, accountId));

    if (!acc) throw new NotFoundProblem("Conta não encontrada.", `/accounts/${accountId}`);
    if (acc.userId !== userId)
      throw new ForbiddenProblem("Acesso negado à conta.", `/accounts/${accountId}`);

    return acc;
  }

  private async validateCategory(userId: string, categoryId: string) {
    const [cat] = await this.app.db.select().from(categories).where(eq(categories.id, categoryId));

    if (!cat) throw new NotFoundProblem("Categoria não encontrada.", `/categories/${categoryId}`);
    if (cat.userId !== userId)
      throw new ForbiddenProblem("Acesso negado à categoria.", `/categories/${categoryId}`);

    return cat;
  }

  private async validateSubcategory(userId: string, subcategoryId: string) {
    const [sub] = await this.app.db
      .select()
      .from(subcategories)
      .where(eq(subcategories.id, subcategoryId));

    if (!sub)
      throw new NotFoundProblem("Subcategoria não encontrada.", `/subcategories/${subcategoryId}`);
    if (sub.userId !== userId)
      throw new ForbiddenProblem(
        "Acesso negado à subcategoria.",
        `/subcategories/${subcategoryId}`,
      );

    return sub;
  }

  private validateTypeMatchesCategory(type: string, categoryType: string) {
    if (type !== categoryType) {
      throw new ValidationProblem(
        `O tipo da transação (${type}) não corresponde ao tipo da categoria (${categoryType}).`,
        "/transactions",
      );
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                               CREATE                                        */
  /* -------------------------------------------------------------------------- */

  async create(userId: string, data: CreateTransactionInput) {
    const { accountId, categoryId, subcategoryId } = data;

    // valida conta
    await this.validateAccount(userId, accountId);

    // valida categoria
    const cat = await this.validateCategory(userId, categoryId);

    // valida subcategoria (se enviada)
    if (subcategoryId) {
      const sub = await this.validateSubcategory(userId, subcategoryId);

      if (sub.categoryId !== categoryId) {
        throw new ConflictProblem(
          "A subcategoria não pertence à categoria informada.",
          "/transactions",
        );
      }
    }

    // regra: type deve ser igual ao tipo da categoria
    this.validateTypeMatchesCategory(data.type, cat.type);

    // cria transação
    const [tx] = await this.app.db
      .insert(transactions)
      .values({
        userId,
        accountId,
        categoryId,
        subcategoryId: subcategoryId ?? null,
        type: data.type,
        amount: data.amount.toString(), // decimal
        date: data.date,
        description: data.description ?? null,
        notes: data.notes ?? null,
      })
      .returning();

    return {
      ...tx,
      amount: Number(tx.amount),
    };
  }

  /* -------------------------------------------------------------------------- */
  /*                                LIST                                         */
  /* -------------------------------------------------------------------------- */

  async list(userId: string, query: ListTransactionsQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;

    const filters = [eq(transactions.userId, userId)];

    if (query.startDate) filters.push(gte(transactions.date, query.startDate));
    if (query.endDate) filters.push(lte(transactions.date, query.endDate));
    if (query.accountId) filters.push(eq(transactions.accountId, query.accountId));
    if (query.categoryId) filters.push(eq(transactions.categoryId, query.categoryId));
    if (query.subcategoryId) filters.push(eq(transactions.subcategoryId, query.subcategoryId));
    if (query.type) filters.push(eq(transactions.type, query.type as TransactionType));
    const useUnaccent =
      (query.description || query.notes) ? await this.hasUnaccent() : false;

    if (query.description) {
      if (useUnaccent) {
        filters.push(
          sql`unaccent(${transactions.description}) ILIKE unaccent(${`%${query.description}%`})`,
        );
      } else {
        filters.push(ilike(transactions.description, `%${query.description}%`));
      }
    }
    if (query.notes) {
      if (useUnaccent) {
        filters.push(sql`unaccent(${transactions.notes}) ILIKE unaccent(${`%${query.notes}%`})`);
      } else {
        filters.push(ilike(transactions.notes, `%${query.notes}%`));
      }
    }

    const sortKey = query.sort ?? "date";
    const sortDirection = query.dir === "asc" ? asc : desc;
    const orderBy = (() => {
      switch (sortKey) {
        case "amount":
          return [sortDirection(transactions.amount), desc(transactions.createdAt)];
        case "type":
          return [sortDirection(transactions.type), desc(transactions.createdAt)];
        case "description":
          return [sortDirection(transactions.description), desc(transactions.createdAt)];
        case "account":
          return [sortDirection(accounts.name), desc(transactions.createdAt)];
        case "category":
          return [sortDirection(categories.name), desc(transactions.createdAt)];
        case "subcategory":
          return [sortDirection(subcategories.name), desc(transactions.createdAt)];
        case "date":
          return [sortDirection(transactions.date), desc(transactions.createdAt)];
        default:
          return [desc(transactions.date), desc(transactions.createdAt)];
      }
    })();

    const [{ count }] = await this.app.db
      .select({ count: sql<number>`count(*)` })
      .from(transactions)
      .where(and(...filters));

    const rows = await this.app.db
      .select({
        transaction: transactions,
        accountName: accounts.name,
        categoryName: categories.name,
        subcategoryName: subcategories.name,
      })
      .from(transactions)
      .leftJoin(accounts, eq(accounts.id, transactions.accountId))
      .leftJoin(categories, eq(categories.id, transactions.categoryId))
      .leftJoin(subcategories, eq(subcategories.id, transactions.subcategoryId))
      .where(and(...filters))
      .orderBy(...orderBy)
      .limit(limit)
      .offset(offset);

    const data = rows.map((row) => ({
      ...row.transaction,
      amount: Number(row.transaction.amount),
      accountName: row.accountName ?? null,
      categoryName: row.categoryName ?? null,
      subcategoryName: row.subcategoryName ?? null,
    }));

    return {
      data,
      page,
      limit,
      total: Number(count),
    };
  }

  /* -------------------------------------------------------------------------- */
  /*                                GET ONE                                      */
  /* -------------------------------------------------------------------------- */

  async getOne(id: string, userId: string) {
    const [tx] = await this.app.db.select().from(transactions).where(eq(transactions.id, id));

    if (!tx) throw new NotFoundProblem("Transação não encontrada.", `/transactions/${id}`);

    if (tx.userId !== userId)
      throw new ForbiddenProblem("Acesso negado à transação.", `/transactions/${id}`);

    return {
      ...tx,
      amount: Number(tx.amount),
    };
  }

  /* -------------------------------------------------------------------------- */
  /*                                UPDATE                                       */
  /* -------------------------------------------------------------------------- */

  async update(id: string, userId: string, data: UpdateTransactionInput) {
    const tx = await this.getOne(id, userId);

    let newCategory = null;
    let newSubcategory = null;

    if (data.categoryId) {
      newCategory = await this.validateCategory(userId, data.categoryId);
    }

    if (data.subcategoryId) {
      newSubcategory = await this.validateSubcategory(userId, data.subcategoryId);
    }

    if (newCategory && newSubcategory && newSubcategory.categoryId !== newCategory.id) {
      throw new ConflictProblem(
        "A subcategoria não pertence à categoria informada.",
        `/transactions/${id}`,
      );
    }

    const finalType = data.type ?? tx.type;

    // tipo da categoria deve ser obtido da categoria final
    let finalCategoryType = tx.type;

    if (newCategory) {
      finalCategoryType = newCategory.type;
    } else {
      // pega categoria original da transação
      const oldCategory = await this.validateCategory(userId, tx.categoryId);
      finalCategoryType = oldCategory.type;
    }

    this.validateTypeMatchesCategory(finalType, finalCategoryType);

    const [updated] = await this.app.db
      .update(transactions)
      .set({
        categoryId: data.categoryId ?? tx.categoryId,
        subcategoryId: data.subcategoryId ?? tx.subcategoryId,
        accountId: data.accountId ?? tx.accountId,
        type: finalType,
        amount: data.amount?.toString() ?? tx.amount,
        date: data.date ?? tx.date,
        description: data.description ?? tx.description,
        notes: data.notes ?? tx.notes,
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, id))
      .returning();

    return {
      ...updated,
      amount: Number(updated.amount),
    };
  }

  /* -------------------------------------------------------------------------- */
  /*                                DELETE                                       */
  /* -------------------------------------------------------------------------- */

  async delete(id: string, userId: string) {
    await this.getOne(id, userId);

    await this.app.db.delete(transactions).where(eq(transactions.id, id));

    return { message: "Transação removida com sucesso." };
  }

  /* -------------------------------------------------------------------------- */
  /*                                SUMMARY                                     */
  /* -------------------------------------------------------------------------- */

  async summary(userId: string, query: SummaryTransactionsQuery) {
    const filters = [eq(transactions.userId, userId)];

    if (query.startDate) {
      filters.push(gte(transactions.date, query.startDate));
    }

    if (query.endDate) {
      filters.push(lte(transactions.date, query.endDate));
    }

    if (query.accountId) {
      filters.push(eq(transactions.accountId, query.accountId));
    }

    if (query.categoryId) {
      filters.push(eq(transactions.categoryId, query.categoryId));
    }

    if (query.subcategoryId) {
      filters.push(eq(transactions.subcategoryId, query.subcategoryId));
    }

    const [incomeRow] = await this.app.db
      .select({
        total: sum(transactions.amount),
      })
      .from(transactions)
      .where(and(...filters, eq(transactions.type, "income")));

    const [expenseRow] = await this.app.db
      .select({
        total: sum(transactions.amount),
      })
      .from(transactions)
      .where(and(...filters, eq(transactions.type, "expense")));

    const income = Number(incomeRow?.total ?? 0);
    const expense = Number(expenseRow?.total ?? 0);

    return {
      income,
      expense,
      balance: income - expense,
    };
  }
}
