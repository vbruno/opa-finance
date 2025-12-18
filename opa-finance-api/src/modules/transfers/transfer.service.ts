// src/modules/transfers/transfer.service.ts
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { CreateTransferInput } from "./transfer.schemas";
import type { DB } from "@/core/plugins/drizzle";
import { transactions } from "@/db/schema";

export class TransferService {
  constructor(private app: FastifyInstance) {}

  async createTransfer(userId: string, data: CreateTransferInput) {
    return await this.app.db.transaction(async (tx: DB) => {
      // débito
      const [expenseTx] = await tx
        .insert(transactions)
        .values({
          userId,
          accountId: data.fromAccountId,
          type: "expense",
          amount: data.amount.toString(),
          date: data.date,
          transferId: data.transferId,
        })
        .returning();

      // crédito
      const [incomeTx] = await tx
        .insert(transactions)
        .values({
          userId,
          accountId: data.toAccountId,
          type: "income",
          amount: data.amount.toString(),
          date: data.date,
          transferId: data.transferId,
        })
        .returning();

      return {
        expense: expenseTx,
        income: incomeTx,
      };
    });
  }
}
