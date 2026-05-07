import { randomUUID } from "crypto";
import { and, count, eq, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { ConflictProblem, NotFoundProblem, UnprocessableProblem } from "../../core/errors/problems";
import type { DB } from "../../core/plugins/drizzle";
import {
  compareIsoDate,
  getFirstOccurrenceOnOrAfter,
  type RecurrenceSchedule,
} from "../../core/utils/recurrence-schedule.utils";
import {
  categories,
  recurrenceOccurrenceOverrides,
  recurrenceOccurrences,
  recurrences,
  transactions,
} from "../../db/schema";
import { RecurrenceAudit } from "./recurrence.audit";
import { addOneYearIsoDate, resolveOperationalEndDate } from "./recurrence.helpers";
import type {
  ConfirmRecurrenceOccurrenceInput,
  RecurrenceAnticipateInput,
  RecurrenceOccurrenceReviewPayload,
  SkipRecurrenceOccurrenceInput,
} from "./recurrence.schemas";
import { recurrenceOccurrenceReviewPayloadSchema } from "./recurrence.schemas";
import { RecurrenceValidators } from "./recurrence.validators";

type RecurrenceOccurrenceMetadata = {
  source?: string;
  generatedAt?: string;
  confirmedAt?: string;
  skippedAt?: string;
  skipReason?: string;
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
    private recurrenceAudit: RecurrenceAudit,
  ) {}

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
      addOneYearIsoDate(await this.validators.getNowIsoDateInTimezone(recurrence.timezone));

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

  private async getPendingOccurrenceForReviewAction(
    userId: string,
    occurrenceId: string,
    expectedVersion: number,
    actionPath: string,
  ) {
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
      throw new NotFoundProblem("Pendência não encontrada.", actionPath);
    }

    if (loaded.occurrence.status !== "pending_review") {
      if (loaded.occurrence.version !== expectedVersion) {
        throw new ConflictProblem(
          "Esta pendência já foi processada por outra requisição. Atualize a página e tente novamente.",
          actionPath,
        );
      }

      throw new UnprocessableProblem("Esta ocorrência não está pendente de revisão.", actionPath);
    }

    if (loaded.occurrence.version !== expectedVersion) {
      throw new ConflictProblem(
        "Esta pendência já foi processada por outra requisição. Atualize a página e tente novamente.",
        actionPath,
      );
    }

    return loaded;
  }

  async confirm(userId: string, occurrenceId: string, input: ConfirmRecurrenceOccurrenceInput) {
    const actionPath = `/recurrences/occurrences/${occurrenceId}/confirm`;
    const loaded = await this.getPendingOccurrenceForReviewAction(
      userId,
      occurrenceId,
      input.expectedVersion,
      actionPath,
    );

    const reviewPayload = recurrenceOccurrenceReviewPayloadSchema.parse(
      loaded.occurrence.reviewPayload,
    );
    const confirmPayload = this.mergeConfirmPayload(reviewPayload, input);
    await this.validateConfirmDate(loaded.recurrence, confirmPayload.occurrenceDate);
    await this.validateConfirmPayloadOwnership(userId, loaded.recurrence, confirmPayload);

    const confirmedOccurrence = await this.app.db.transaction(async (tx: DB) => {
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
          actionPath,
        );
      }

      const result =
        confirmPayload.originType === "transaction"
          ? await this.createTransactionFromPending(tx, loaded.recurrence, confirmPayload)
          : await this.createTransferFromPending(tx, loaded.recurrence, confirmPayload);

      const [savedOccurrence] = await tx
        .update(recurrenceOccurrences)
        .set({
          transactionId: result.transactionId,
          transferId: result.transferId,
        })
        .where(eq(recurrenceOccurrences.id, occurrenceId))
        .returning();

      return {
        ...savedOccurrence,
        reviewPayload: confirmPayload,
      };
    });

    await this.recurrenceAudit.logBestEffort(
      {
        userId,
        entityType: "recurrence_occurrence",
        entityId: confirmedOccurrence.id,
        action: "confirm",
        beforeData: this.recurrenceAudit.toOccurrenceAuditData(
          loaded.occurrence,
          loaded.occurrence.reviewPayload as Record<string, unknown> | null,
        ),
        afterData: this.recurrenceAudit.toOccurrenceAuditData(
          confirmedOccurrence,
          confirmedOccurrence.reviewPayload as Record<string, unknown> | null,
        ),
        metadata: {
          operation: "recurrence-occurrence-confirm",
        },
      },
      {
        recurrenceId: loaded.recurrence.id,
        userId,
        occurrenceId: confirmedOccurrence.id,
        operation: "recurrence-occurrence-confirm",
      },
    );

    return confirmedOccurrence;
  }

  async anticipate(userId: string, recurrenceId: string, input: RecurrenceAnticipateInput) {
    const actionPath = `/recurrences/${recurrenceId}/anticipate`;

    const [loaded] = await this.app.db
      .select()
      .from(recurrences)
      .where(
        and(
          eq(recurrences.id, recurrenceId),
          eq(recurrences.userId, userId),
          sql`${recurrences.deletedAt} IS NULL`,
        ),
      )
      .limit(1);

    if (!loaded) {
      throw new NotFoundProblem("Recorrência não encontrada.", actionPath);
    }

    if (loaded.status !== "active") {
      throw new UnprocessableProblem(
        "Apenas recorrências ativas podem ter ocorrências antecipadas.",
        actionPath,
      );
    }

    const schedule: RecurrenceSchedule = {
      startDate: loaded.startDate,
      frequency: loaded.frequency,
      dayOfWeek: loaded.dayOfWeek,
      dayOfMonth: loaded.dayOfMonth,
      monthOfYear: loaded.monthOfYear,
    };

    const firstOnOrAfter = getFirstOccurrenceOnOrAfter(schedule, input.occurrenceDate);
    if (firstOnOrAfter !== input.occurrenceDate) {
      throw new UnprocessableProblem(
        "A data informada não corresponde a uma ocorrência válida da série.",
        actionPath,
      );
    }

    if (compareIsoDate(input.occurrenceDate, loaded.startDate) < 0) {
      throw new UnprocessableProblem(
        "A data informada é anterior ao início da recorrência.",
        actionPath,
      );
    }

    const operationalEndDate = resolveOperationalEndDate(loaded);
    if (operationalEndDate && compareIsoDate(input.occurrenceDate, operationalEndDate) > 0) {
      throw new UnprocessableProblem(
        loaded.endType === "never"
          ? "A data informada ultrapassa o limite de 1 ano da recorrência sem fim."
          : "A data informada é posterior ao término da recorrência.",
        actionPath,
      );
    }

    const [existing] = await this.app.db
      .select({ id: recurrenceOccurrences.id })
      .from(recurrenceOccurrences)
      .where(
        and(
          eq(recurrenceOccurrences.recurrenceId, recurrenceId),
          eq(recurrenceOccurrences.occurrenceDate, input.occurrenceDate),
        ),
      )
      .limit(1);

    if (existing) {
      throw new ConflictProblem("Já existe uma ocorrência registrada para esta data.", actionPath);
    }

    if (loaded.endType === "by_occurrences" && loaded.endOccurrences) {
      const [consumedResult] = await this.app.db
        .select({ total: count() })
        .from(recurrenceOccurrences)
        .where(
          and(
            eq(recurrenceOccurrences.recurrenceId, recurrenceId),
            sql`${recurrenceOccurrences.status} IN ('materialized', 'pending_review', 'skipped')`,
          ),
        );

      if ((consumedResult?.total ?? 0) >= loaded.endOccurrences) {
        throw new UnprocessableProblem(
          "A recorrência já atingiu o número máximo de ocorrências.",
          actionPath,
        );
      }
    }

    const reviewPayload: RecurrenceOccurrenceReviewPayload = {
      occurrenceDate: input.occurrenceDate,
      originalScheduledDate: input.occurrenceDate,
      originType: loaded.originType,
      amount: input.amount ?? Number(loaded.amount),
      description: input.description !== undefined ? input.description : loaded.description,
      notes: input.notes !== undefined ? input.notes : loaded.notes,
      accountId: input.accountId ?? loaded.accountId,
      categoryId: input.categoryId ?? loaded.categoryId,
      subcategoryId: input.subcategoryId !== undefined ? input.subcategoryId : loaded.subcategoryId,
      fromAccountId: input.fromAccountId ?? loaded.fromAccountId,
      toAccountId: input.toAccountId ?? loaded.toAccountId,
    };

    await this.validateConfirmPayloadOwnership(userId, loaded, reviewPayload);

    const confirmedOccurrence = await this.app.db.transaction(async (tx: DB) => {
      const confirmedAt = new Date().toISOString();

      const [newOccurrence] = await tx
        .insert(recurrenceOccurrences)
        .values({
          recurrenceId,
          originType: loaded.originType,
          occurrenceDate: input.occurrenceDate,
          status: "materialized",
          version: 1,
          reviewPayload,
          metadata: { confirmedAt, source: "anticipate" },
        })
        .returning();

      const result =
        reviewPayload.originType === "transaction"
          ? await this.createTransactionFromPending(tx, loaded, reviewPayload)
          : await this.createTransferFromPending(tx, loaded, reviewPayload);

      const [savedOccurrence] = await tx
        .update(recurrenceOccurrences)
        .set({
          transactionId: result.transactionId,
          transferId: result.transferId,
        })
        .where(eq(recurrenceOccurrences.id, newOccurrence.id))
        .returning();

      return {
        ...savedOccurrence,
        reviewPayload,
      };
    });

    await this.recurrenceAudit.logBestEffort(
      {
        userId,
        entityType: "recurrence_occurrence",
        entityId: confirmedOccurrence.id,
        action: "confirm",
        beforeData: null,
        afterData: this.recurrenceAudit.toOccurrenceAuditData(
          confirmedOccurrence,
          confirmedOccurrence.reviewPayload as Record<string, unknown> | null,
        ),
        metadata: {
          operation: "recurrence-occurrence-anticipate",
        },
      },
      {
        recurrenceId: loaded.id,
        userId,
        occurrenceId: confirmedOccurrence.id,
        operation: "recurrence-occurrence-anticipate",
      },
    );

    return confirmedOccurrence;
  }

  async skip(userId: string, occurrenceId: string, input: SkipRecurrenceOccurrenceInput) {
    const actionPath = `/recurrences/occurrences/${occurrenceId}/skip`;
    const loaded = await this.getPendingOccurrenceForReviewAction(
      userId,
      occurrenceId,
      input.expectedVersion,
      actionPath,
    );

    const skippedOccurrence = await this.app.db.transaction(async (tx: DB) => {
      const skippedAt = new Date().toISOString();
      const previousMetadata = (loaded.occurrence.metadata ?? {}) as RecurrenceOccurrenceMetadata;
      const metadata: RecurrenceOccurrenceMetadata = {
        ...previousMetadata,
        skippedAt,
      };

      if (input.reason) {
        metadata.skipReason = input.reason;
      }

      const [savedOccurrence] = await tx
        .update(recurrenceOccurrences)
        .set({
          status: "skipped",
          version: loaded.occurrence.version + 1,
          metadata,
        })
        .where(
          and(
            eq(recurrenceOccurrences.id, occurrenceId),
            eq(recurrenceOccurrences.status, "pending_review"),
            eq(recurrenceOccurrences.version, input.expectedVersion),
          ),
        )
        .returning();

      if (!savedOccurrence) {
        throw new ConflictProblem(
          "Esta pendência já foi processada por outra requisição. Atualize a página e tente novamente.",
          actionPath,
        );
      }

      await tx
        .delete(recurrenceOccurrenceOverrides)
        .where(
          and(
            eq(recurrenceOccurrenceOverrides.recurrenceId, loaded.recurrence.id),
            eq(recurrenceOccurrenceOverrides.occurrenceDate, loaded.occurrence.occurrenceDate),
          ),
        );

      return savedOccurrence;
    });

    await this.recurrenceAudit.logBestEffort(
      {
        userId,
        entityType: "recurrence_occurrence",
        entityId: skippedOccurrence.id,
        action: "skip",
        beforeData: this.recurrenceAudit.toOccurrenceAuditData(
          loaded.occurrence,
          loaded.occurrence.reviewPayload as Record<string, unknown> | null,
        ),
        afterData: this.recurrenceAudit.toOccurrenceAuditData(
          skippedOccurrence,
          skippedOccurrence.reviewPayload as Record<string, unknown> | null,
        ),
        metadata: {
          operation: "recurrence-occurrence-skip",
        },
      },
      {
        recurrenceId: loaded.recurrence.id,
        userId,
        occurrenceId: skippedOccurrence.id,
        operation: "recurrence-occurrence-skip",
      },
    );

    return skippedOccurrence;
  }
}
