import { randomUUID } from "crypto";
import { and, eq, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { ConflictProblem, NotFoundProblem, UnprocessableProblem } from "../../core/errors/problems";
import type { DB } from "../../core/plugins/drizzle";
import { compareIsoDate } from "../../core/utils/recurrence-schedule.utils";
import { categories, recurrenceOccurrences, recurrences, transactions } from "../../db/schema";
import type {
  ConfirmRecurrenceOccurrenceInput,
  RecurrenceOccurrenceReviewPayload,
} from "./recurrence.schemas";
import { recurrenceOccurrenceReviewPayloadSchema } from "./recurrence.schemas";
import { RecurrenceValidators } from "./recurrence.validators";

type RecurrenceOccurrenceMetadata = {
  source?: string;
  generatedAt?: string;
  confirmedAt?: string;
  adjustments?: {
    fields: string[];
    adjustedAt: string;
  };
  [key: string]: unknown;
};

type ConfirmPayload = RecurrenceOccurrenceReviewPayload;

export class RecurrenceOccurrenceService {
  constructor(
    private app: FastifyInstance,
    private validators: RecurrenceValidators,
  ) {}

  private addOneYear(dateString: string) {
    const [year, month, day] = dateString.split("-").map(Number);
    const next = new Date(Date.UTC(year + 1, month - 1, day));
    return next.toISOString().slice(0, 10);
  }

  private mergeConfirmPayload(
    reviewPayload: RecurrenceOccurrenceReviewPayload,
    input: ConfirmRecurrenceOccurrenceInput,
  ): ConfirmPayload {
    return {
      ...reviewPayload,
      occurrenceDate: input.occurrenceDate ?? reviewPayload.occurrenceDate,
      amount: input.amount ?? reviewPayload.amount,
      description: input.description !== undefined ? input.description : reviewPayload.description,
      notes: input.notes !== undefined ? input.notes : reviewPayload.notes,
      accountId: input.accountId ?? reviewPayload.accountId,
      categoryId: input.categoryId ?? reviewPayload.categoryId,
      subcategoryId:
        input.subcategoryId !== undefined ? input.subcategoryId : reviewPayload.subcategoryId,
      fromAccountId: input.fromAccountId ?? reviewPayload.fromAccountId,
      toAccountId: input.toAccountId ?? reviewPayload.toAccountId,
    };
  }

  private getAdjustedFields(
    reviewPayload: RecurrenceOccurrenceReviewPayload,
    confirmPayload: ConfirmPayload,
  ) {
    const fields: Array<keyof ConfirmPayload> = [
      "occurrenceDate",
      "amount",
      "description",
      "notes",
      "accountId",
      "categoryId",
      "subcategoryId",
      "fromAccountId",
      "toAccountId",
    ];

    return fields.filter((field) => reviewPayload[field] !== confirmPayload[field]);
  }

  private async validateConfirmDate(
    recurrence: typeof recurrences.$inferSelect,
    occurrenceDate: string,
  ) {
    const minDate = recurrence.startDate;
    const maxDate =
      recurrence.endDate ??
      this.addOneYear(await this.validators.getNowIsoDateInTimezone(recurrence.timezone));

    if (
      compareIsoDate(occurrenceDate, minDate) < 0 ||
      compareIsoDate(occurrenceDate, maxDate) > 0
    ) {
      throw new UnprocessableProblem(
        `A data ajustada deve estar entre ${minDate} e ${maxDate}.`,
        "/recurrences/occurrences/confirm",
      );
    }
  }

  private async validateConfirmPayloadOwnership(
    userId: string,
    recurrence: typeof recurrences.$inferSelect,
    payload: ConfirmPayload,
  ) {
    if (payload.originType === "transaction") {
      if (!payload.accountId || !payload.categoryId) {
        throw new UnprocessableProblem(
          "Pendência de transação possui conta ou categoria inválida.",
          "/recurrences/occurrences/confirm",
        );
      }

      await this.validators.validatePayloadOwnership(userId, {
        originType: "transaction",
        postingMode: recurrence.postingMode,
        frequency: recurrence.frequency,
        startDate: recurrence.startDate,
        endType: recurrence.endType,
        accountId: payload.accountId,
        categoryId: payload.categoryId,
        subcategoryId: payload.subcategoryId ?? undefined,
        amount: payload.amount,
      });
      return;
    }

    if (!payload.fromAccountId || !payload.toAccountId) {
      throw new UnprocessableProblem(
        "Pendência de transferência possui contas inválidas.",
        "/recurrences/occurrences/confirm",
      );
    }
    if (payload.fromAccountId === payload.toAccountId) {
      throw new UnprocessableProblem(
        "Conta de origem e destino devem ser diferentes.",
        "/recurrences/occurrences/confirm",
      );
    }

    await this.validators.validatePayloadOwnership(userId, {
      originType: "transfer",
      postingMode: recurrence.postingMode,
      frequency: recurrence.frequency,
      startDate: recurrence.startDate,
      endType: recurrence.endType,
      fromAccountId: payload.fromAccountId,
      toAccountId: payload.toAccountId,
      amount: payload.amount,
    });
  }

  private async createTransactionFromPending(
    tx: DB,
    recurrence: typeof recurrences.$inferSelect,
    payload: ConfirmPayload,
  ) {
    if (!payload.accountId || !payload.categoryId) {
      throw new UnprocessableProblem(
        "Pendência de transação possui conta ou categoria inválida.",
        "/recurrences/occurrences/confirm",
      );
    }

    const [category] = await tx
      .select({ type: categories.type })
      .from(categories)
      .where(eq(categories.id, payload.categoryId))
      .limit(1);

    if (!category) {
      throw new UnprocessableProblem(
        "Categoria da pendência não encontrada.",
        "/recurrences/occurrences/confirm",
      );
    }

    const [created] = await tx
      .insert(transactions)
      .values({
        userId: recurrence.userId,
        accountId: payload.accountId,
        categoryId: payload.categoryId,
        subcategoryId: payload.subcategoryId ?? null,
        type: category.type,
        amount: payload.amount.toString(),
        date: payload.occurrenceDate,
        description: payload.description,
        notes: payload.notes,
      })
      .returning({ id: transactions.id });

    return { transactionId: created.id, transferId: null as string | null };
  }

  private async createTransferFromPending(
    tx: DB,
    recurrence: typeof recurrences.$inferSelect,
    payload: ConfirmPayload,
  ) {
    if (!payload.fromAccountId || !payload.toAccountId) {
      throw new UnprocessableProblem(
        "Pendência de transferência possui contas inválidas.",
        "/recurrences/occurrences/confirm",
      );
    }

    const transferCategoryId = await this.validators.getTransferCategoryId();
    const transferId = randomUUID();

    const inserted = await tx
      .insert(transactions)
      .values([
        {
          userId: recurrence.userId,
          accountId: payload.fromAccountId,
          categoryId: transferCategoryId,
          type: "expense",
          amount: payload.amount.toString(),
          date: payload.occurrenceDate,
          description: payload.description,
          notes: payload.notes,
          transferId,
        },
        {
          userId: recurrence.userId,
          accountId: payload.toAccountId,
          categoryId: transferCategoryId,
          type: "income",
          amount: payload.amount.toString(),
          date: payload.occurrenceDate,
          description: payload.description,
          notes: payload.notes,
          transferId,
        },
      ])
      .returning({ id: transactions.id });

    if (inserted.length !== 2) {
      throw new UnprocessableProblem(
        "Falha ao confirmar transferência recorrente de forma atômica.",
        "/recurrences/occurrences/confirm",
      );
    }

    return { transactionId: null as string | null, transferId };
  }

  async confirm(userId: string, occurrenceId: string, input: ConfirmRecurrenceOccurrenceInput) {
    const [loaded] = await this.app.db
      .select({
        occurrence: recurrenceOccurrences,
        recurrence: recurrences,
      })
      .from(recurrenceOccurrences)
      .innerJoin(recurrences, eq(recurrenceOccurrences.recurrenceId, recurrences.id))
      .where(
        and(
          eq(recurrenceOccurrences.id, occurrenceId),
          eq(recurrences.userId, userId),
          sql`${recurrences.deletedAt} IS NULL`,
        ),
      )
      .limit(1);

    if (!loaded) {
      throw new NotFoundProblem(
        "Pendência não encontrada.",
        `/recurrences/occurrences/${occurrenceId}/confirm`,
      );
    }

    if (loaded.occurrence.status !== "pending_review") {
      if (loaded.occurrence.version !== input.expectedVersion) {
        throw new ConflictProblem(
          "Esta pendência já foi processada por outra requisição. Atualize a página e tente novamente.",
          `/recurrences/occurrences/${occurrenceId}/confirm`,
        );
      }

      throw new UnprocessableProblem(
        "Esta ocorrência não está pendente de revisão.",
        `/recurrences/occurrences/${occurrenceId}/confirm`,
      );
    }

    if (loaded.occurrence.version !== input.expectedVersion) {
      throw new ConflictProblem(
        "Esta pendência já foi processada por outra requisição. Atualize a página e tente novamente.",
        `/recurrences/occurrences/${occurrenceId}/confirm`,
      );
    }

    const reviewPayload = recurrenceOccurrenceReviewPayloadSchema.parse(
      loaded.occurrence.reviewPayload,
    );
    const confirmPayload = this.mergeConfirmPayload(reviewPayload, input);
    await this.validateConfirmDate(loaded.recurrence, confirmPayload.occurrenceDate);
    await this.validateConfirmPayloadOwnership(userId, loaded.recurrence, confirmPayload);

    return this.app.db.transaction(async (tx: DB) => {
      const adjustedFields = this.getAdjustedFields(reviewPayload, confirmPayload);
      const previousMetadata = (loaded.occurrence.metadata ?? {}) as RecurrenceOccurrenceMetadata;
      const confirmedAt = new Date().toISOString();
      const metadata: RecurrenceOccurrenceMetadata = {
        ...previousMetadata,
        confirmedAt,
      };

      if (adjustedFields.length > 0) {
        metadata.adjustments = {
          fields: adjustedFields,
          adjustedAt: confirmedAt,
        };
      }

      const [lockedOccurrence] = await tx
        .update(recurrenceOccurrences)
        .set({
          status: "materialized",
          version: loaded.occurrence.version + 1,
          metadata,
          reviewPayload: confirmPayload,
        })
        .where(
          and(
            eq(recurrenceOccurrences.id, occurrenceId),
            eq(recurrenceOccurrences.status, "pending_review"),
            eq(recurrenceOccurrences.version, input.expectedVersion),
          ),
        )
        .returning();

      if (!lockedOccurrence) {
        throw new ConflictProblem(
          "Esta pendência já foi processada por outra requisição. Atualize a página e tente novamente.",
          `/recurrences/occurrences/${occurrenceId}/confirm`,
        );
      }

      const result =
        confirmPayload.originType === "transaction"
          ? await this.createTransactionFromPending(tx, loaded.recurrence, confirmPayload)
          : await this.createTransferFromPending(tx, loaded.recurrence, confirmPayload);

      const [confirmedOccurrence] = await tx
        .update(recurrenceOccurrences)
        .set({
          transactionId: result.transactionId,
          transferId: result.transferId,
        })
        .where(eq(recurrenceOccurrences.id, occurrenceId))
        .returning();

      return {
        ...confirmedOccurrence,
        reviewPayload: confirmPayload,
      };
    });
  }
}
