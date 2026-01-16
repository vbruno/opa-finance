// src/modules/accounts/account.service.ts
import { eq, and, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

import { NotFoundProblem, ForbiddenProblem, ConflictProblem } from "../../core/errors/problems";

import { accounts, transactions } from "../../db/schema";
import type { CreateAccountInput, UpdateAccountInput } from "./account.schemas";

export class AccountService {
  constructor(private app: FastifyInstance) {}

  private buildCurrentBalanceExpr() {
    return sql<number>`(coalesce(sum(case
      when ${transactions.type} = 'income' then ${transactions.amount}
      when ${transactions.type} = 'expense' then -${transactions.amount}
      else 0 end), 0))`;
  }

  private accountGroupByColumns() {
    return [
      accounts.id,
      accounts.userId,
      accounts.name,
      accounts.type,
      accounts.initialBalance,
      accounts.color,
      accounts.icon,
      accounts.isPrimary,
      accounts.createdAt,
      accounts.updatedAt,
    ];
  }

  private handlePrimaryConflict(error: unknown, path: string) {
    if (typeof error === "object" && error !== null && "code" in error) {
      if ((error as { code?: string }).code === "23505") {
        throw new ConflictProblem("Já existe uma conta principal para este usuário.", path);
      }
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                                   CREATE                                   */
  /* -------------------------------------------------------------------------- */
  async create(userId: string, data: CreateAccountInput) {
    try {
      const account = await this.app.db.transaction(async (tx: typeof this.app.db) => {
        const [currentPrimary] = await tx
          .select({ id: accounts.id })
          .from(accounts)
          .where(and(eq(accounts.userId, userId), eq(accounts.isPrimary, true)))
          .limit(1);

        const shouldBePrimary = data.isPrimary === true || !currentPrimary;

        if (shouldBePrimary) {
          await tx.update(accounts).set({ isPrimary: false }).where(eq(accounts.userId, userId));
        }

        const [created] = await tx
          .insert(accounts)
          .values({ ...data, initialBalance: 0, isPrimary: shouldBePrimary, userId })
          .returning();

        return created;
      });

      const { initialBalance, ...rest } = account;
      void initialBalance;
      return {
        ...rest,
        currentBalance: 0,
      };
    } catch (error) {
      this.handlePrimaryConflict(error, "/accounts");
      throw error;
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                                    LIST                                    */
  /* -------------------------------------------------------------------------- */
  async list(userId: string) {
    const currentBalance = this.buildCurrentBalanceExpr();
    const rows = await this.app.db
      .select({
        account: accounts,
        currentBalance,
      })
      .from(accounts)
      .leftJoin(
        transactions,
        and(eq(transactions.accountId, accounts.id), eq(transactions.userId, accounts.userId)),
      )
      .where(eq(accounts.userId, userId))
      .groupBy(...this.accountGroupByColumns());

    return rows.map((row: (typeof rows)[number]) => {
      const { initialBalance, ...rest } = row.account;
      void initialBalance;
      return {
        ...rest,
        currentBalance: Number(row.currentBalance),
      };
    });
  }

  /* -------------------------------------------------------------------------- */
  /*                                  GET ONE                                   */
  /* -------------------------------------------------------------------------- */
  async getOne(id: string, userId: string) {
    const currentBalance = this.buildCurrentBalanceExpr();
    const [row] = await this.app.db
      .select({
        account: accounts,
        currentBalance,
      })
      .from(accounts)
      .leftJoin(
        transactions,
        and(eq(transactions.accountId, accounts.id), eq(transactions.userId, accounts.userId)),
      )
      .where(eq(accounts.id, id))
      .groupBy(...this.accountGroupByColumns());

    if (!row?.account) {
      throw new NotFoundProblem("Conta não encontrada.", `/accounts/${id}`);
    }

    if (row.account.userId !== userId) {
      throw new ForbiddenProblem("Você não tem acesso a esta conta.", `/accounts/${id}`);
    }

    const { initialBalance, ...rest } = row.account;
    void initialBalance;
    return {
      ...rest,
      currentBalance: Number(row.currentBalance),
    };
  }

  /* -------------------------------------------------------------------------- */
  /*                                  UPDATE                                    */
  /* -------------------------------------------------------------------------- */
  async update(id: string, userId: string, data: UpdateAccountInput) {
    const current = await this.getOne(id, userId); // já valida 404 e 403

    try {
      await this.app.db.transaction(async (tx: typeof this.app.db) => {
        if (data.isPrimary === false && current.isPrimary === true) {
          throw new ConflictProblem(
            "A conta principal não pode ser desmarcada sem definir outra conta principal.",
            `/accounts/${id}`,
          );
        }

        if (data.isPrimary === true) {
          await tx.update(accounts).set({ isPrimary: false }).where(eq(accounts.userId, userId));
        }

        const [row] = await tx.update(accounts).set(data).where(eq(accounts.id, id)).returning();
        return row;
      });

      return await this.getOne(id, userId);
    } catch (error) {
      this.handlePrimaryConflict(error, `/accounts/${id}`);
      throw error;
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                               SET PRIMARY                                  */
  /* -------------------------------------------------------------------------- */
  async setPrimary(id: string, userId: string) {
    await this.getOne(id, userId);

    try {
      await this.app.db.transaction(async (tx: typeof this.app.db) => {
        await tx.update(accounts).set({ isPrimary: false }).where(eq(accounts.userId, userId));

        const [row] = await tx
          .update(accounts)
          .set({ isPrimary: true })
          .where(eq(accounts.id, id))
          .returning();

        return row;
      });

      return await this.getOne(id, userId);
    } catch (error) {
      this.handlePrimaryConflict(error, `/accounts/${id}/primary`);
      throw error;
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                                  DELETE                                    */
  /* -------------------------------------------------------------------------- */
  async delete(id: string, userId: string) {
    const current = await this.getOne(id, userId);

    if (current.isPrimary === true) {
      throw new ConflictProblem(
        "A conta principal não pode ser removida. Defina outra conta como principal antes.",
        `/accounts/${id}`,
      );
    }

    const [tx] = await this.app.db
      .select({ id: transactions.id })
      .from(transactions)
      .where(eq(transactions.accountId, id))
      .limit(1);

    if (tx) {
      throw new ConflictProblem(
        "Conta possui transações e não pode ser removida.",
        `/accounts/${id}`,
      );
    }

    await this.app.db.delete(accounts).where(eq(accounts.id, id));

    return { message: "Conta removida com sucesso." };
  }
}
