import { randomUUID } from "crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import {
  ConflictProblem,
  NotFoundProblem,
  UnprocessableProblem,
  ValidationProblem,
} from "../../core/errors/problems";
import type { DB } from "../../core/plugins/drizzle";
import {
  addIsoDaysToDate,
  compareIsoDate,
  getNextOccurrenceAfter,
  type RecurrenceSchedule,
} from "../../core/utils/recurrence-schedule.utils";
import {
  categories,
  recurrenceOccurrenceOverrides,
  recurrenceOccurrences,
  recurrences,
  transactions,
} from "../../db/schema";
import { AuditService } from "../audit/audit.service";
import { RecurrenceCrudService } from "./recurrence-crud.service";
import { RecurrenceAudit } from "./recurrence.audit";
import {
  buildCreatePayloadFromRecurrence,
  getFirstOccurrenceForRecurrence,
  mergeLastMaterializedDate,
  serializeRecurrence,
} from "./recurrence.helpers";
import {
  createRecurrenceSchema,
  recurrenceOccurrenceReviewPayloadSchema,
  type EditRecurrenceByScopeInput,
  type UpdateRecurrenceInput,
} from "./recurrence.schemas";
import { RecurrenceValidators } from "./recurrence.validators";

type SerializedRecurrence = ReturnType<typeof serializeRecurrence>;

const GLOBAL_EDIT_ALLOWED_FIELDS_AFTER_CONSUMPTION = [
  "description",
  "notes",
  "expectedVersion",
] as const;

const GLOBAL_EDIT_LOCK_MESSAGE =
  'Esta recorrência já possui ocorrências geradas. Edite apenas descrição/observações ou use "Esta e próximas" para mudanças futuras.';

export class RecurrenceEditService {
  constructor(
    private app: FastifyInstance,
    private auditService: AuditService,
    private recurrenceAudit: RecurrenceAudit,
    private validators: RecurrenceValidators,
    private crud: RecurrenceCrudService,
  ) {}

  private ensureOriginSpecificUpdatePayload(
    originType: "transaction" | "transfer",
    data: UpdateRecurrenceInput,
  ) {
    if (originType === "transaction") {
      if (data.fromAccountId !== undefined || data.toAccountId !== undefined) {
        throw new ValidationProblem(
          "Recorrência de transação não aceita contas de transferência.",
          "/recurrences",
        );
      }
      return;
    }

    if (
      data.accountId !== undefined ||
      data.categoryId !== undefined ||
      data.subcategoryId !== undefined
    ) {
      throw new ValidationProblem(
        "Recorrência de transferência não aceita conta/categoria/subcategoria de transação.",
        "/recurrences",
      );
    }
  }

  private hasScheduleChanges(data: UpdateRecurrenceInput) {
    return (
      data.frequency !== undefined ||
      data.startDate !== undefined ||
      data.dayOfWeek !== undefined ||
      data.dayOfMonth !== undefined ||
      data.monthOfYear !== undefined ||
      data.endType !== undefined ||
      data.endOccurrences !== undefined ||
      data.endDate !== undefined
    );
  }

  private ensureSingleScopeAllowedFields(data: UpdateRecurrenceInput) {
    if (this.hasScheduleChanges(data)) {
      throw new ValidationProblem(
        "Escopo 'single' não permite alterar agenda da recorrência.",
        "/recurrences",
      );
    }
  }

  private ensureGlobalUpdateAllowedAfterConsumption(
    data: UpdateRecurrenceInput,
    recurrenceId: string,
  ) {
    const allowedFields = new Set<string>(GLOBAL_EDIT_ALLOWED_FIELDS_AFTER_CONSUMPTION);
    const attemptedBlockedField = Object.entries(data).some(
      ([key, value]) => value !== undefined && !allowedFields.has(key),
    );

    if (attemptedBlockedField) {
      throw new UnprocessableProblem(GLOBAL_EDIT_LOCK_MESSAGE, `/recurrences/${recurrenceId}`);
    }
  }

  private ensureOriginSpecificSingleScopePayload(
    recurrence: SerializedRecurrence,
    changes: UpdateRecurrenceInput,
  ) {
    if (recurrence.originType === "transaction") {
      if (changes.fromAccountId !== undefined || changes.toAccountId !== undefined) {
        throw new ValidationProblem(
          "Escopo 'single' para transação não aceita contas de transferência.",
          "/recurrences",
        );
      }
      return;
    }

    if (
      changes.accountId !== undefined ||
      changes.categoryId !== undefined ||
      changes.subcategoryId !== undefined
    ) {
      throw new ValidationProblem(
        "Escopo 'single' para transferência não aceita conta/categoria de transação.",
        "/recurrences",
      );
    }
  }

  private async getOpenPendingReviewOccurrences(userId: string, recurrenceId: string) {
    return this.app.db
      .select({
        id: recurrenceOccurrences.id,
        occurrenceDate: recurrenceOccurrences.occurrenceDate,
      })
      .from(recurrenceOccurrences)
      .innerJoin(recurrences, eq(recurrenceOccurrences.recurrenceId, recurrences.id))
      .where(
        and(
          eq(recurrenceOccurrences.recurrenceId, recurrenceId),
          eq(recurrenceOccurrences.status, "pending_review"),
          eq(recurrences.userId, userId),
          sql`${recurrences.deletedAt} IS NULL`,
        ),
      );
  }

  private buildSingleScopeReviewPayloadChanges(
    recurrence: SerializedRecurrence,
    changes: UpdateRecurrenceInput,
  ) {
    const reviewPayloadChanges: Record<string, unknown> = {};

    if (changes.amount !== undefined) reviewPayloadChanges.amount = changes.amount;
    if (changes.description !== undefined) reviewPayloadChanges.description = changes.description;
    if (changes.notes !== undefined) reviewPayloadChanges.notes = changes.notes;

    if (recurrence.originType === "transaction") {
      if (changes.accountId !== undefined) reviewPayloadChanges.accountId = changes.accountId;
      if (changes.categoryId !== undefined) reviewPayloadChanges.categoryId = changes.categoryId;
      if (changes.subcategoryId !== undefined) {
        reviewPayloadChanges.subcategoryId = changes.subcategoryId;
      } else if (changes.categoryId !== undefined) {
        reviewPayloadChanges.subcategoryId = null;
      }
      return reviewPayloadChanges;
    }

    if (changes.fromAccountId !== undefined) {
      reviewPayloadChanges.fromAccountId = changes.fromAccountId;
    }
    if (changes.toAccountId !== undefined) {
      reviewPayloadChanges.toAccountId = changes.toAccountId;
    }
    return reviewPayloadChanges;
  }

  private async applySingleScopePendingReviewEdit(
    userId: string,
    recurrenceId: string,
    recurrence: SerializedRecurrence,
    occurrenceDate: string,
    occurrence: typeof recurrenceOccurrences.$inferSelect,
    changes: UpdateRecurrenceInput,
  ) {
    const currentReviewPayload = recurrenceOccurrenceReviewPayloadSchema.parse(
      occurrence.reviewPayload,
    );
    const reviewPayload = recurrenceOccurrenceReviewPayloadSchema.parse({
      ...currentReviewPayload,
      ...this.buildSingleScopeReviewPayloadChanges(recurrence, changes),
    });

    if (recurrence.originType === "transfer") {
      if (reviewPayload.fromAccountId === reviewPayload.toAccountId) {
        throw new ValidationProblem(
          "Conta de origem e destino devem ser diferentes.",
          `/recurrences/${recurrenceId}`,
        );
      }
    }

    const updatedOccurrence = await this.app.db.transaction(async (tx: DB) => {
      const [savedOccurrence] = await tx
        .update(recurrenceOccurrences)
        .set({
          reviewPayload,
          version: occurrence.version + 1,
        })
        .where(
          and(
            eq(recurrenceOccurrences.id, occurrence.id),
            eq(recurrenceOccurrences.status, "pending_review"),
            eq(recurrenceOccurrences.version, occurrence.version),
          ),
        )
        .returning();

      if (!savedOccurrence) {
        throw new ConflictProblem(
          "Esta pendência já foi processada por outra requisição. Atualize a página e tente novamente.",
          `/recurrences/${recurrenceId}`,
        );
      }

      return savedOccurrence;
    });

    await this.recurrenceAudit.logBestEffort(
      {
        userId,
        entityType: "recurrence_occurrence",
        entityId: updatedOccurrence.id,
        action: "update",
        beforeData: this.recurrenceAudit.toOccurrenceAuditData(
          occurrence,
          currentReviewPayload as Record<string, unknown> | null,
        ),
        afterData: this.recurrenceAudit.toOccurrenceAuditData(
          updatedOccurrence,
          updatedOccurrence.reviewPayload as Record<string, unknown> | null,
        ),
        metadata: {
          operation: "recurrence-edit-scope-single-pending-review",
          scope: "single",
          occurrenceDate,
          changes,
        },
      },
      {
        recurrenceId,
        userId,
        occurrenceId: updatedOccurrence.id,
        operation: "recurrence-edit-scope-single-pending-review",
      },
    );

    return { scope: "single" as const, occurrenceDate, recurrence };
  }

  private async applySingleScopeEdit(
    userId: string,
    recurrenceId: string,
    recurrence: SerializedRecurrence,
    occurrenceDate: string,
    changes: UpdateRecurrenceInput,
  ) {
    this.ensureSingleScopeAllowedFields(changes);
    this.ensureOriginSpecificSingleScopePayload(recurrence, changes);

    await this.validators.validatePayloadOwnership(userId, changes, recurrence.categoryId);

    const [pendingOccurrence] = await this.app.db
      .select()
      .from(recurrenceOccurrences)
      .where(
        and(
          eq(recurrenceOccurrences.recurrenceId, recurrenceId),
          eq(recurrenceOccurrences.occurrenceDate, occurrenceDate),
          eq(recurrenceOccurrences.status, "pending_review"),
        ),
      )
      .limit(1);

    if (pendingOccurrence) {
      return this.applySingleScopePendingReviewEdit(
        userId,
        recurrenceId,
        recurrence,
        occurrenceDate,
        pendingOccurrence,
        changes,
      );
    }

    const today = await this.validators.getNowIsoDateInTimezone(recurrence.timezone);
    if (compareIsoDate(occurrenceDate, today) < 0) {
      throw new ValidationProblem(
        "Não é permitido editar ocorrência materializada passada via fluxo de recorrência.",
        `/recurrences/${recurrenceId}`,
      );
    }

    const [occurrence] = await this.app.db
      .select({
        id: recurrenceOccurrences.id,
        transactionId: recurrenceOccurrences.transactionId,
        transferId: recurrenceOccurrences.transferId,
      })
      .from(recurrenceOccurrences)
      .where(
        and(
          eq(recurrenceOccurrences.recurrenceId, recurrenceId),
          eq(recurrenceOccurrences.occurrenceDate, occurrenceDate),
          eq(recurrenceOccurrences.status, "materialized"),
        ),
      )
      .limit(1);

    if (!occurrence) {
      throw new UnprocessableProblem(
        "Não é possível editar uma ocorrência projetada por este fluxo. Use a sobrescrita pontual (PUT /recurrences/:id/occurrences/override) para alterar valor, descrição ou observações desta data.",
        `/recurrences/${recurrenceId}`,
      );
    }

    if (recurrence.originType === "transaction") {
      return this.applySingleScopeTransactionEdit(
        userId,
        recurrenceId,
        recurrence,
        occurrenceDate,
        occurrence as { id: string; transactionId: string | null; transferId: string | null },
        changes,
      );
    }
    return this.applySingleScopeTransferEdit(
      userId,
      recurrenceId,
      recurrence,
      occurrenceDate,
      occurrence as { id: string; transactionId: string | null; transferId: string | null },
      changes,
    );
  }

  private async applySingleScopeTransactionEdit(
    userId: string,
    recurrenceId: string,
    recurrence: SerializedRecurrence,
    occurrenceDate: string,
    occurrence: { id: string; transactionId: string | null; transferId: string | null },
    changes: UpdateRecurrenceInput,
  ) {
    if (!occurrence.transactionId) {
      throw new ValidationProblem(
        "Ocorrência de transação sem vínculo para edição.",
        `/recurrences/${recurrenceId}`,
      );
    }

    const [currentTx] = await this.app.db
      .select({ id: transactions.id, categoryId: transactions.categoryId, type: transactions.type })
      .from(transactions)
      .where(and(eq(transactions.id, occurrence.transactionId), eq(transactions.userId, userId)))
      .limit(1);

    if (!currentTx) {
      throw new NotFoundProblem(
        "Transação da ocorrência não encontrada para edição.",
        `/recurrences/${recurrenceId}`,
      );
    }

    let nextType = currentTx.type;
    if (changes.categoryId !== undefined) {
      const [category] = await this.app.db
        .select({ type: categories.type })
        .from(categories)
        .where(eq(categories.id, changes.categoryId))
        .limit(1);

      if (!category) {
        throw new NotFoundProblem("Categoria não encontrada.", `/recurrences/${recurrenceId}`);
      }
      nextType = category.type;
    }

    const payload: Partial<typeof transactions.$inferInsert> = { updatedAt: new Date() };
    if (changes.accountId !== undefined) payload.accountId = changes.accountId;
    if (changes.categoryId !== undefined) payload.categoryId = changes.categoryId;
    if (changes.subcategoryId !== undefined) payload.subcategoryId = changes.subcategoryId;
    if (changes.categoryId !== undefined && changes.subcategoryId === undefined) {
      payload.subcategoryId = null;
    }
    if (changes.amount !== undefined) payload.amount = changes.amount.toString();
    if (changes.description !== undefined) payload.description = changes.description;
    if (changes.notes !== undefined) payload.notes = changes.notes;
    payload.type = nextType;

    await this.app.db
      .update(transactions)
      .set(payload)
      .where(and(eq(transactions.id, currentTx.id), eq(transactions.userId, userId)));

    await this.auditService.log({
      userId,
      entityType: "recurrence",
      entityId: recurrenceId,
      action: "update",
      beforeData: this.recurrenceAudit.toAuditData(recurrence),
      afterData: this.recurrenceAudit.toAuditData(recurrence),
      metadata: {
        operation: "recurrence-edit-scope-single",
        scope: "single",
        occurrenceDate,
        changes,
      },
    });

    return { scope: "single" as const, occurrenceDate, recurrence };
  }

  private async applySingleScopeTransferEdit(
    userId: string,
    recurrenceId: string,
    recurrence: SerializedRecurrence,
    occurrenceDate: string,
    occurrence: { id: string; transactionId: string | null; transferId: string | null },
    changes: UpdateRecurrenceInput,
  ) {
    if (!occurrence.transferId) {
      throw new ValidationProblem(
        "Ocorrência de transferência sem vínculo para edição.",
        `/recurrences/${recurrenceId}`,
      );
    }

    const transferTransactions: Array<{
      id: string;
      type: "income" | "expense";
      accountId: string;
    }> = await this.app.db
      .select({ id: transactions.id, type: transactions.type, accountId: transactions.accountId })
      .from(transactions)
      .where(
        and(eq(transactions.transferId, occurrence.transferId), eq(transactions.userId, userId)),
      );

    const expenseTx = transferTransactions.find((t) => t.type === "expense");
    const incomeTx = transferTransactions.find((t) => t.type === "income");

    if (!expenseTx || !incomeTx) {
      throw new ValidationProblem(
        "Transferência da ocorrência está inconsistente para edição.",
        `/recurrences/${recurrenceId}`,
      );
    }

    const nextFromAccountId = changes.fromAccountId ?? expenseTx.accountId;
    const nextToAccountId = changes.toAccountId ?? incomeTx.accountId;
    if (nextFromAccountId === nextToAccountId) {
      throw new ValidationProblem(
        "Conta de origem e destino devem ser diferentes.",
        `/recurrences/${recurrenceId}`,
      );
    }

    const basePayload: Partial<typeof transactions.$inferInsert> = { updatedAt: new Date() };
    if (changes.amount !== undefined) basePayload.amount = changes.amount.toString();
    if (changes.description !== undefined) basePayload.description = changes.description;
    if (changes.notes !== undefined) basePayload.notes = changes.notes;

    await this.app.db.transaction(async (tx: DB) => {
      await tx
        .update(transactions)
        .set({ ...basePayload, accountId: changes.fromAccountId ?? undefined })
        .where(and(eq(transactions.id, expenseTx.id), eq(transactions.userId, userId)));
      await tx
        .update(transactions)
        .set({ ...basePayload, accountId: changes.toAccountId ?? undefined })
        .where(and(eq(transactions.id, incomeTx.id), eq(transactions.userId, userId)));
    });

    await this.auditService.log({
      userId,
      entityType: "recurrence",
      entityId: recurrenceId,
      action: "update",
      beforeData: this.recurrenceAudit.toAuditData(recurrence),
      afterData: this.recurrenceAudit.toAuditData(recurrence),
      metadata: {
        operation: "recurrence-edit-scope-single",
        scope: "single",
        occurrenceDate,
        changes,
      },
    });

    return { scope: "single" as const, occurrenceDate, recurrence };
  }

  async update(userId: string, recurrenceId: string, data: UpdateRecurrenceInput) {
    const existing = await this.crud.getOne(userId, recurrenceId);
    await this.validators.validateRecurrenceLinkedOwnership(
      userId,
      existing,
      `/recurrences/${recurrenceId}`,
    );
    this.ensureOriginSpecificUpdatePayload(existing.originType, data);

    if (existing.status !== "active") {
      throw new ValidationProblem(
        "Apenas recorrências ativas podem ser atualizadas.",
        `/recurrences/${recurrenceId}`,
      );
    }

    if (data.expectedVersion !== undefined && data.expectedVersion !== existing.version) {
      throw new ConflictProblem(
        "A recorrência foi alterada por outra sessão. Recarregue e tente novamente.",
        `/recurrences/${recurrenceId}`,
      );
    }

    const hasConsumedOccurrences = await this.validators.hasConsumedOccurrences(recurrenceId);
    if (hasConsumedOccurrences) {
      this.ensureGlobalUpdateAllowedAfterConsumption(data, recurrenceId);
    }

    if (data.postingMode === "automatic" && existing.postingMode === "review_required") {
      const pendingOccurrences = await this.getOpenPendingReviewOccurrences(userId, recurrenceId);
      if (pendingOccurrences.length > 0) {
        const pendingIds = pendingOccurrences
          .map((occurrence: { id: string }) => occurrence.id)
          .join(", ");
        throw new UnprocessableProblem(
          `Esta recorrência possui pendências em aberto (${pendingIds}). Resolva-as antes de alterar o modo de lançamento.`,
          `/recurrences/${recurrenceId}`,
        );
      }
    }

    await this.validators.validatePayloadOwnership(userId, data, existing.categoryId);

    const latestMaterializedDate = await this.validators.getLatestMaterializedDate(recurrenceId);
    const effectiveLastMaterializedDate = mergeLastMaterializedDate(
      existing.lastMaterializedDate,
      latestMaterializedDate,
    );

    const mergedStartDate = data.startDate ?? existing.startDate;
    const nextEndType = data.endType ?? existing.endType;
    const mergedEndDate = nextEndType === "until_date" ? (data.endDate ?? existing.endDate) : null;
    if (mergedEndDate && mergedEndDate < mergedStartDate) {
      throw new ValidationProblem(
        "Data final não pode ser anterior à data de início.",
        `/recurrences/${recurrenceId}`,
      );
    }

    const payload: Partial<typeof recurrences.$inferInsert> = {};
    const nextFrequency = data.frequency ?? existing.frequency;
    if (data.frequency !== undefined) {
      payload.frequency = data.frequency;
      if (nextFrequency === "weekly" || nextFrequency === "biweekly") {
        payload.dayOfMonth = null;
        payload.monthOfYear = null;
      }
      if (nextFrequency === "monthly") {
        payload.dayOfWeek = null;
        payload.monthOfYear = null;
      }
      if (nextFrequency === "yearly") {
        payload.dayOfWeek = null;
      }
    }
    if (data.startDate !== undefined) payload.startDate = data.startDate;
    if (
      data.dayOfWeek !== undefined &&
      (nextFrequency === "weekly" || nextFrequency === "biweekly")
    ) {
      payload.dayOfWeek = data.dayOfWeek;
    }
    if (
      data.dayOfMonth !== undefined &&
      (nextFrequency === "monthly" || nextFrequency === "yearly")
    ) {
      payload.dayOfMonth = data.dayOfMonth;
    }
    if (data.monthOfYear !== undefined && nextFrequency === "yearly") {
      payload.monthOfYear = data.monthOfYear;
    }
    if (data.endType !== undefined) {
      payload.endType = data.endType;
      if (data.endType === "never") {
        payload.endOccurrences = null;
        payload.endDate = null;
      }
      if (data.endType === "by_occurrences") {
        payload.endDate = null;
      }
      if (data.endType === "until_date") {
        payload.endOccurrences = null;
      }
    }
    if (nextEndType === "by_occurrences" && data.endOccurrences !== undefined) {
      payload.endOccurrences = data.endOccurrences;
    }
    if (nextEndType === "until_date" && data.endDate !== undefined) {
      payload.endDate = data.endDate;
    }
    if (data.postingMode !== undefined) payload.postingMode = data.postingMode;
    if (data.accountId !== undefined) payload.accountId = data.accountId;
    if (data.categoryId !== undefined) payload.categoryId = data.categoryId;
    if (data.subcategoryId !== undefined) payload.subcategoryId = data.subcategoryId;
    if (data.categoryId !== undefined && data.subcategoryId === undefined) {
      payload.subcategoryId = null;
    }
    if (data.fromAccountId !== undefined) payload.fromAccountId = data.fromAccountId;
    if (data.toAccountId !== undefined) payload.toAccountId = data.toAccountId;
    if (data.amount !== undefined) payload.amount = data.amount.toString();
    if (data.description !== undefined) payload.description = data.description;
    if (data.notes !== undefined) payload.notes = data.notes;

    if (
      data.startDate !== undefined ||
      data.frequency !== undefined ||
      data.dayOfWeek !== undefined ||
      data.dayOfMonth !== undefined ||
      data.monthOfYear !== undefined
    ) {
      const schedule = {
        startDate: data.startDate ?? existing.startDate,
        frequency: data.frequency ?? existing.frequency,
        dayOfWeek: data.dayOfWeek ?? existing.dayOfWeek,
        dayOfMonth: data.dayOfMonth ?? existing.dayOfMonth,
        monthOfYear: data.monthOfYear ?? existing.monthOfYear,
      } as Pick<
        typeof recurrences.$inferSelect,
        "startDate" | "frequency" | "dayOfWeek" | "dayOfMonth" | "monthOfYear"
      >;

      try {
        payload.nextOccurrenceDate = effectiveLastMaterializedDate
          ? getNextOccurrenceAfter(schedule as RecurrenceSchedule, effectiveLastMaterializedDate)
          : getFirstOccurrenceForRecurrence(schedule);
      } catch {
        throw new ValidationProblem(
          "Não foi possível recalcular agenda da recorrência. Verifique os dados da regra.",
          `/recurrences/${recurrenceId}`,
        );
      }
    }

    payload.version = existing.version + 1;
    payload.updatedAt = new Date();

    const [updated] = await this.app.db.transaction(async (tx: DB) => {
      const [updatedRow] = await tx
        .update(recurrences)
        .set(payload)
        .where(and(eq(recurrences.id, recurrenceId), eq(recurrences.version, existing.version)))
        .returning();

      if (!updatedRow) {
        return [];
      }

      await this.auditService.log(
        {
          userId,
          entityType: "recurrence",
          entityId: updatedRow.id,
          action: "update",
          beforeData: this.recurrenceAudit.toAuditData(existing),
          afterData: this.recurrenceAudit.toAuditData(updatedRow),
          metadata: {
            operation: "recurrence-update",
          },
        },
        tx,
      );

      return [updatedRow];
    });

    if (!updated) {
      throw new ConflictProblem(
        "A recorrência foi alterada por outra sessão. Recarregue e tente novamente.",
        `/recurrences/${recurrenceId}`,
      );
    }

    return {
      ...serializeRecurrence(updated),
      hasConsumedOccurrences,
    };
  }

  async editByScope(userId: string, recurrenceId: string, input: EditRecurrenceByScopeInput) {
    const recurrence = await this.crud.getOne(userId, recurrenceId);
    await this.validators.validateRecurrenceLinkedOwnership(
      userId,
      recurrence,
      `/recurrences/${recurrenceId}`,
    );
    const changes = input.changes;

    if (recurrence.status !== "active") {
      throw new ValidationProblem(
        "Apenas recorrências ativas podem ser editadas por escopo.",
        `/recurrences/${recurrenceId}`,
      );
    }

    if (input.scope === "all") {
      const updated = await this.update(userId, recurrenceId, changes);
      return { scope: "all" as const, recurrence: updated };
    }

    const latestMaterializedDate = await this.validators.getLatestMaterializedDate(recurrenceId);
    const effectiveLastMaterializedDate = mergeLastMaterializedDate(
      recurrence.lastMaterializedDate,
      latestMaterializedDate,
    );

    if (!input.occurrenceDate) {
      throw new ValidationProblem(
        "Data da ocorrência é obrigatória.",
        `/recurrences/${recurrenceId}`,
      );
    }

    if (input.scope === "single") {
      return this.applySingleScopeEdit(
        userId,
        recurrenceId,
        recurrence,
        input.occurrenceDate,
        changes,
      );
    }

    if (changes.startDate !== undefined) {
      throw new ValidationProblem(
        "Escopo 'this_and_next' define início pela data da ocorrência alvo.",
        `/recurrences/${recurrenceId}`,
      );
    }

    if (compareIsoDate(input.occurrenceDate, recurrence.startDate) <= 0) {
      const updated = await this.update(userId, recurrenceId, changes);
      return { scope: "all" as const, recurrence: updated };
    }

    if (
      effectiveLastMaterializedDate &&
      compareIsoDate(input.occurrenceDate, effectiveLastMaterializedDate) <= 0
    ) {
      throw new ValidationProblem(
        "Não é permitido aplicar 'esta e próximas' para ocorrência já materializada.",
        `/recurrences/${recurrenceId}`,
      );
    }

    const targetOccurrenceDate = input.occurrenceDate;
    const oldRecurrenceEndDate = addIsoDaysToDate(targetOccurrenceDate, -1);
    const createPayload = buildCreatePayloadFromRecurrence(
      recurrence,
      { ...changes, expectedVersion: undefined },
      targetOccurrenceDate,
    );
    const validatedCreatePayload = createRecurrenceSchema.parse(createPayload);
    await this.validators.validatePayloadOwnership(
      userId,
      validatedCreatePayload,
      recurrence.categoryId,
    );

    const [previousRecurrence, newRecurrence] = await this.app.db.transaction(async (tx: DB) => {
      const [current] = await tx
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

      if (!current) {
        throw new NotFoundProblem("Recorrência não encontrada.", `/recurrences/${recurrenceId}`);
      }
      if (current.status !== "active") {
        throw new ValidationProblem(
          "Apenas recorrências ativas podem ser editadas por escopo.",
          `/recurrences/${recurrenceId}`,
        );
      }
      if (changes.expectedVersion !== undefined && current.version !== changes.expectedVersion) {
        throw new ConflictProblem(
          "A recorrência foi alterada por outra sessão. Recarregue e tente novamente.",
          `/recurrences/${recurrenceId}`,
        );
      }
      const txLatestMaterializedDate = await this.validators.getLatestMaterializedDate(
        recurrenceId,
        tx,
      );
      const txEffectiveLastMaterializedDate = mergeLastMaterializedDate(
        current.lastMaterializedDate,
        txLatestMaterializedDate,
      );
      if (
        txEffectiveLastMaterializedDate &&
        compareIsoDate(targetOccurrenceDate, txEffectiveLastMaterializedDate) <= 0
      ) {
        throw new ValidationProblem(
          "Não é permitido aplicar 'esta e próximas' para ocorrência já materializada.",
          `/recurrences/${recurrenceId}`,
        );
      }

      const [closedRecurrence] = await tx
        .update(recurrences)
        .set({
          endType: "until_date",
          endDate: oldRecurrenceEndDate,
          updatedAt: new Date(),
          version: current.version + 1,
        })
        .where(and(eq(recurrences.id, recurrenceId), eq(recurrences.version, current.version)))
        .returning();

      if (!closedRecurrence) {
        throw new ConflictProblem(
          "A recorrência foi alterada por outra sessão. Recarregue e tente novamente.",
          `/recurrences/${recurrenceId}`,
        );
      }

      let nextOccurrenceDate: string;
      try {
        nextOccurrenceDate = getFirstOccurrenceForRecurrence({
          startDate: validatedCreatePayload.startDate,
          frequency: validatedCreatePayload.frequency,
          dayOfWeek: validatedCreatePayload.dayOfWeek ?? null,
          dayOfMonth: validatedCreatePayload.dayOfMonth ?? null,
          monthOfYear: validatedCreatePayload.monthOfYear ?? null,
        });
      } catch {
        throw new ValidationProblem(
          "Regra de recorrência inválida para cálculo de agenda.",
          `/recurrences/${recurrenceId}`,
        );
      }

      const [createdRecurrence] = await tx
        .insert(recurrences)
        .values({
          userId,
          originType: validatedCreatePayload.originType,
          status: "active",
          timezone: current.timezone,
          frequency: validatedCreatePayload.frequency,
          startDate: validatedCreatePayload.startDate,
          dayOfWeek: validatedCreatePayload.dayOfWeek ?? null,
          dayOfMonth: validatedCreatePayload.dayOfMonth ?? null,
          monthOfYear: validatedCreatePayload.monthOfYear ?? null,
          endType: validatedCreatePayload.endType,
          endOccurrences: validatedCreatePayload.endOccurrences ?? null,
          endDate: validatedCreatePayload.endDate ?? null,
          accountId: validatedCreatePayload.accountId ?? null,
          categoryId: validatedCreatePayload.categoryId ?? null,
          subcategoryId: validatedCreatePayload.subcategoryId ?? null,
          fromAccountId: validatedCreatePayload.fromAccountId ?? null,
          toAccountId: validatedCreatePayload.toAccountId ?? null,
          amount: validatedCreatePayload.amount.toString(),
          description: validatedCreatePayload.description ?? null,
          notes: validatedCreatePayload.notes ?? null,
          nextOccurrenceDate,
        })
        .returning();

      const overridesToMigrate = await tx
        .select()
        .from(recurrenceOccurrenceOverrides)
        .where(
          and(
            eq(recurrenceOccurrenceOverrides.recurrenceId, recurrenceId),
            sql`${recurrenceOccurrenceOverrides.occurrenceDate} >= ${targetOccurrenceDate}`,
          ),
        );

      if (overridesToMigrate.length > 0) {
        await tx.insert(recurrenceOccurrenceOverrides).values(
          overridesToMigrate.map((override) => ({
            id: randomUUID(),
            recurrenceId: createdRecurrence.id,
            userId: override.userId,
            occurrenceDate: override.occurrenceDate,
            amount: override.amount,
            description: override.description,
            notes: override.notes,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
        );
        await tx.delete(recurrenceOccurrenceOverrides).where(
          inArray(
            recurrenceOccurrenceOverrides.id,
            overridesToMigrate.map((override) => override.id),
          ),
        );
      }

      await this.auditService.log(
        {
          userId,
          entityType: "recurrence",
          entityId: closedRecurrence.id,
          action: "update",
          beforeData: this.recurrenceAudit.toAuditData(current),
          afterData: this.recurrenceAudit.toAuditData(closedRecurrence),
          metadata: {
            operation: "recurrence-edit-scope-this-and-next-close",
            scope: "this_and_next",
            occurrenceDate: targetOccurrenceDate,
          },
        },
        tx,
      );

      await this.auditService.log(
        {
          userId,
          entityType: "recurrence",
          entityId: createdRecurrence.id,
          action: "create",
          beforeData: null,
          afterData: this.recurrenceAudit.toAuditData(createdRecurrence),
          metadata: {
            operation: "recurrence-edit-scope-this-and-next-create",
            scope: "this_and_next",
            occurrenceDate: targetOccurrenceDate,
          },
        },
        tx,
      );

      return [serializeRecurrence(closedRecurrence), serializeRecurrence(createdRecurrence)];
    });

    return {
      scope: "this_and_next" as const,
      previousRecurrence,
      newRecurrence,
    };
  }
}
