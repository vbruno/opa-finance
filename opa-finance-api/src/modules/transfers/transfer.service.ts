// src/modules/transfers/transfer.service.ts
import { randomUUID } from "crypto";
import { and, eq, isNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { NotFoundProblem, ForbiddenProblem, ValidationProblem } from "../../core/errors/problems";
import type { DB } from "../../core/plugins/drizzle";
import { transactions, accounts, categories } from "../../db/schema";
import { CreateTransferInput } from "./transfer.schemas";

export class TransferService {
  constructor(private app: FastifyInstance) {}

  /* -------------------------------------------------------------------------- */
  /*                               VALIDADORES                                   */
  /* -------------------------------------------------------------------------- */

  private async validateAccount(userId: string, accountId: string, accountName: string) {
    const [account] = await this.app.db.select().from(accounts).where(eq(accounts.id, accountId));

    if (!account) {
      throw new NotFoundProblem(`${accountName} não encontrada.`, `/accounts/${accountId}`);
    }

    if (account.userId !== userId) {
      throw new ForbiddenProblem(
        `Acesso negado à ${accountName.toLowerCase()}.`,
        `/accounts/${accountId}`,
      );
    }

    return account;
  }

  private async getTransferCategory() {
    const [category] = await this.app.db
      .select()
      .from(categories)
      .where(
        and(
          eq(categories.name, "Transferência"),
          eq(categories.system, true),
          isNull(categories.userId),
        ),
      );

    if (!category) {
      throw new NotFoundProblem(
        "Categoria de sistema 'Transferência' não encontrada. Execute o seed do sistema.",
        "/transfers",
      );
    }

    return category;
  }

  /* -------------------------------------------------------------------------- */
  /*                                CREATE                                       */
  /* -------------------------------------------------------------------------- */

  async create(userId: string, data: CreateTransferInput) {
    // Valida que as contas são diferentes
    if (data.fromAccountId === data.toAccountId) {
      throw new ValidationProblem(
        "A conta de origem e destino devem ser diferentes.",
        "/transfers",
      );
    }

    // Valida conta de origem
    await this.validateAccount(userId, data.fromAccountId, "Conta de origem");

    // Valida conta de destino
    await this.validateAccount(userId, data.toAccountId, "Conta de destino");

    // Busca categoria de sistema "Transferência"
    const transferCategory = await this.getTransferCategory();

    // Gera transferId único para vincular as duas transações
    const transferId = randomUUID();

    return await this.app.db.transaction(async (tx: DB) => {
      // Transação de débito (saída da conta de origem)
      const [expenseTx] = await tx
        .insert(transactions)
        .values({
          userId,
          accountId: data.fromAccountId,
          categoryId: transferCategory.id,
          type: "expense",
          amount: data.amount.toString(),
          date: data.date,
          description: data.description ?? null,
          transferId,
        })
        .returning();

      // Transação de crédito (entrada na conta de destino)
      const [incomeTx] = await tx
        .insert(transactions)
        .values({
          userId,
          accountId: data.toAccountId,
          categoryId: transferCategory.id,
          type: "income",
          amount: data.amount.toString(),
          date: data.date,
          description: data.description ?? null,
          transferId,
        })
        .returning();

      return {
        id: transferId,
        fromAccount: {
          ...expenseTx,
          amount: Number(expenseTx.amount),
        },
        toAccount: {
          ...incomeTx,
          amount: Number(incomeTx.amount),
        },
      };
    });
  }
}
