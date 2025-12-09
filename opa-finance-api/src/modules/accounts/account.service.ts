// src/modules/accounts/account.service.ts
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

import type { CreateAccountInput, UpdateAccountInput } from "./account.schemas";

import { NotFoundProblem, ForbiddenProblem, ConflictProblem } from "@/core/errors/problems";

import { accounts, transactions } from "@/db/schema";

export class AccountService {
  constructor(private app: FastifyInstance) {}

  /* -------------------------------------------------------------------------- */
  /*                                   CREATE                                   */
  /* -------------------------------------------------------------------------- */
  async create(userId: string, data: CreateAccountInput) {
    const [account] = await this.app.db
      .insert(accounts)
      .values({ ...data, userId })
      .returning();

    return {
      ...account,
      initialBalance: Number(account.initialBalance),
    };
  }

  /* -------------------------------------------------------------------------- */
  /*                                    LIST                                    */
  /* -------------------------------------------------------------------------- */
  async list(userId: string) {
    const rows: (typeof accounts.$inferSelect)[] = await this.app.db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, userId));

    return rows.map((acc) => ({
      ...acc,
      initialBalance: Number(acc.initialBalance),
    }));
  }

  /* -------------------------------------------------------------------------- */
  /*                                  GET ONE                                   */
  /* -------------------------------------------------------------------------- */
  async getOne(id: string, userId: string) {
    const [account] = await this.app.db.select().from(accounts).where(eq(accounts.id, id));

    if (!account) {
      throw new NotFoundProblem("Conta não encontrada.", `/accounts/${id}`);
    }

    if (account.userId !== userId) {
      throw new ForbiddenProblem("Você não tem acesso a esta conta.", `/accounts/${id}`);
    }

    return {
      ...account,
      initialBalance: Number(account.initialBalance),
    };
  }

  /* -------------------------------------------------------------------------- */
  /*                                  UPDATE                                    */
  /* -------------------------------------------------------------------------- */
  async update(id: string, userId: string, data: UpdateAccountInput) {
    await this.getOne(id, userId); // já valida 404 e 403

    const [updated] = await this.app.db
      .update(accounts)
      .set(data)
      .where(eq(accounts.id, id))
      .returning();

    return {
      ...updated,
      initialBalance: Number(updated.initialBalance),
    };
  }

  /* -------------------------------------------------------------------------- */
  /*                                  DELETE                                    */
  /* -------------------------------------------------------------------------- */
  async delete(id: string, userId: string) {
    await this.getOne(id, userId);

    const tx = await this.app.db.select().from(transactions).where(eq(transactions.accountId, id));

    if (tx.length > 0) {
      throw new ConflictProblem(
        "Conta possui transações e não pode ser removida.",
        `/accounts/${id}`,
      );
    }

    await this.app.db.delete(accounts).where(eq(accounts.id, id));

    return { message: "Conta removida com sucesso." };
  }
}
