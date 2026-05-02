// src/modules/transfers/transfer.service.ts
import { randomUUID } from "crypto";
import { and, eq, isNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { NotFoundProblem, ForbiddenProblem, ValidationProblem } from "../../core/errors/problems";
import type { DB } from "../../core/plugins/drizzle";
import {
  resolveSubmitOccurrence,
  type RecurrenceSchedule,
} from "../../core/utils/recurrence-schedule.utils";
import { DEFAULT_TIMEZONE } from "../../core/utils/timezone.utils";
import {
  transactions,
  accounts,
  categories,
  recurrenceOccurrences,
  recurrences,
  users,
} from "../../db/schema";
import { AuditService } from "../audit/audit.service";
import { CreateTransferInput } from "./transfer.schemas";

export class TransferService {
  private audit: AuditService;

  constructor(private app: FastifyInstance) {
    this.audit = new AuditService(app);
  }

  private toAuditTransactionPayload(
    tx: typeof transactions.$inferSelect,
    names?: {
      accountName?: string | null;
      categoryName?: string | null;
      subcategoryName?: string | null;
    },
  ): Record<string, unknown> {
    return {
      id: tx.id,
      date: tx.date,
      type: tx.type,
      amount: Number(tx.amount),
      description: tx.description,
      notes: tx.notes,
      accountId: tx.accountId,
      accountName: names?.accountName ?? null,
      categoryId: tx.categoryId,
      categoryName: names?.categoryName ?? null,
      subcategoryId: tx.subcategoryId,
      subcategoryName: names?.subcategoryName ?? null,
      transferId: tx.transferId,
    };
  }

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
    const fromAccount = await this.validateAccount(userId, data.fromAccountId, "Conta de origem");

    // Valida conta de destino
    const toAccount = await this.validateAccount(userId, data.toAccountId, "Conta de destino");

    // Busca categoria de sistema "Transferência"
    const transferCategory = await this.getTransferCategory();
    const [user] = await this.app.db
      .select({ timezone: users.timezone })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const userTimezone = user?.timezone ?? DEFAULT_TIMEZONE;

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

      let recurrenceId: string | null = null;
      if (data.recurrence) {
        const recurrenceStartDate = data.recurrence.startDate ?? data.date;
        const rule: RecurrenceSchedule = {
          startDate: recurrenceStartDate,
          frequency: data.recurrence.frequency,
          dayOfWeek: data.recurrence.dayOfWeek ?? null,
          dayOfMonth: data.recurrence.dayOfMonth ?? null,
          monthOfYear: data.recurrence.monthOfYear ?? null,
        };
        const { materializedOnSubmit, nextOccurrenceDate } = resolveSubmitOccurrence(
          rule,
          data.date,
        );
        const reachesUntilDateOnSubmit =
          materializedOnSubmit &&
          data.recurrence.endType === "until_date" &&
          !!data.recurrence.endDate &&
          data.recurrence.endDate <= data.date;
        const shouldFinalizeImmediately =
          (materializedOnSubmit &&
            data.recurrence.endType === "by_occurrences" &&
            (data.recurrence.endOccurrences ?? 0) <= 1) ||
          reachesUntilDateOnSubmit;

        const [createdRecurrence] = await tx
          .insert(recurrences)
          .values({
            userId,
            originType: "transfer",
            status: shouldFinalizeImmediately ? "finalized" : "active",
            postingMode: data.recurrence.postingMode,
            timezone: userTimezone,
            frequency: data.recurrence.frequency,
            startDate: recurrenceStartDate,
            dayOfWeek: data.recurrence.dayOfWeek ?? null,
            dayOfMonth: data.recurrence.dayOfMonth ?? null,
            monthOfYear: data.recurrence.monthOfYear ?? null,
            endType: data.recurrence.endType,
            endOccurrences: data.recurrence.endOccurrences ?? null,
            endDate: data.recurrence.endDate ?? null,
            fromAccountId: data.fromAccountId,
            toAccountId: data.toAccountId,
            amount: data.amount.toString(),
            description: data.description ?? null,
            notes: data.recurrence.notes ?? null,
            nextOccurrenceDate: shouldFinalizeImmediately ? null : nextOccurrenceDate,
            lastMaterializedDate: materializedOnSubmit ? data.date : null,
            lastMaterializedAt: materializedOnSubmit ? new Date() : null,
            finalizedAt: shouldFinalizeImmediately ? new Date() : null,
          })
          .returning({ id: recurrences.id });

        if (materializedOnSubmit) {
          // Submit already created both transfer legs, so the first occurrence is always launched.
          await tx.insert(recurrenceOccurrences).values({
            recurrenceId: createdRecurrence.id,
            originType: "transfer",
            occurrenceDate: data.date,
            status: "materialized",
            transferId,
            metadata: {
              source: "transfer-submit",
            },
          });
        }

        recurrenceId = createdRecurrence.id;
      }

      await this.audit.log(
        {
          userId,
          entityType: "transaction",
          entityId: expenseTx.id,
          action: "create",
          afterData: this.toAuditTransactionPayload(expenseTx, {
            accountName: fromAccount.name,
            categoryName: transferCategory.name,
          }),
          metadata: {
            operation: "transfer-create",
            transferId,
            side: "fromAccount",
            recurrenceId,
          },
        },
        tx,
      );

      await this.audit.log(
        {
          userId,
          entityType: "transaction",
          entityId: incomeTx.id,
          action: "create",
          afterData: this.toAuditTransactionPayload(incomeTx, {
            accountName: toAccount.name,
            categoryName: transferCategory.name,
          }),
          metadata: {
            operation: "transfer-create",
            transferId,
            side: "toAccount",
            recurrenceId,
          },
        },
        tx,
      );

      return {
        id: transferId,
        recurrenceId,
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
