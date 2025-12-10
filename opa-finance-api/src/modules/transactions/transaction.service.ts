// src/modules/transactions/transaction.service.ts
import { eq } from "drizzle-orm";
import { FastifyInstance } from "fastify";

import type { CreateTransactionInput, UpdateTransactionInput } from "./transaction.schemas";
import {
  NotFoundProblem,
  ForbiddenProblem,
  ConflictProblem,
  ValidationProblem,
} from "@/core/errors/problems";

import { accounts, categories, subcategories, transactions } from "@/db/schema";

export class TransactionService {
  constructor(private app: FastifyInstance) {}

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

  async list(userId: string) {
    const rows = await this.app.db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId));

    return rows.map((tx: typeof transactions.$inferSelect) => ({
      ...tx,
      amount: Number(tx.amount),
    }));
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

    // --- NOVA VALIDAÇÃO CORRETA ---
    const finalType = data.type ?? tx.type;
    const finalCategoryType = newCategory?.type ?? tx.type;

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
}
