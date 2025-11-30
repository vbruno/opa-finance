// account.service.ts
import { eq } from "drizzle-orm";
import { FastifyInstance } from "fastify";
import type { CreateAccountInput, UpdateAccountInput } from "./account.schemas";
import { accounts, transactions } from "@/db/schema";

export class AccountService {
  constructor(private app: FastifyInstance) {}

  async create(userId: string, data: CreateAccountInput) {
    const [account] = await this.app.db
      .insert(accounts)
      .values({ ...data, userId })
      .returning();

    return account;
  }

  async list(userId: string) {
    return this.app.db.select().from(accounts).where(eq(accounts.userId, userId));
  }

  async getOne(id: string, userId: string) {
    const [account] = await this.app.db.select().from(accounts).where(eq(accounts.id, id));

    if (!account) throw new Error("Conta não encontrada.");
    if (account.userId !== userId) throw new Error("Acesso negado.");

    return account;
  }

  async update(id: string, userId: string, data: UpdateAccountInput) {
    await this.getOne(id, userId);

    const [updated] = await this.app.db
      .update(accounts)
      .set(data)
      .where(eq(accounts.id, id))
      .returning();

    return updated;
  }

  async delete(id: string, userId: string) {
    await this.getOne(id, userId);

    const tx = await this.app.db.select().from(transactions).where(eq(transactions.accountId, id));

    if (tx.length > 0) {
      throw new Error("Conta possui transações e não pode ser removida.");
    }

    await this.app.db.delete(accounts).where(eq(accounts.id, id));

    return { message: "Conta removida com sucesso." };
  }
}
