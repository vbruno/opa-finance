import { randomUUID } from "crypto";
import { and, asc, desc, eq, gte, ilike, inArray, isNull, lte, or, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import {
  ConflictProblem,
  ForbiddenProblem,
  NotFoundProblem,
  ValidationProblem,
} from "../../core/errors/problems";
import type { DB } from "../../core/plugins/drizzle";
import {
  addIsoDaysToDate,
  compareIsoDate,
  getFirstOccurrence,
  getFirstOccurrenceOnOrAfter,
  getNextOccurrenceAfter,
  type RecurrenceSchedule,
} from "../../core/utils/recurrence-schedule.utils";
import { DEFAULT_TIMEZONE } from "../../core/utils/timezone.utils";
import {
  accounts,
  categories,
  recurrenceOccurrences,
  recurrences,
  subcategories,
  transactions,
  users,
} from "../../db/schema";
import { AuditService } from "../audit/audit.service";
import type {
  CreateRecurrenceInput,
  EditRecurrenceByScopeInput,
  ListRecurrencesQuery,
  MaterializeRecurrencesInput,
  RecurrencesForecastQuery,
  UpdateRecurrenceInput,
} from "./recurrence.schemas";
import { createRecurrenceSchema } from "./recurrence.schemas";

export class RecurrenceService {
  private audit: AuditService;
  constructor(private app: FastifyInstance) {
    this.audit = new AuditService(app);
  }

  private readonly defaultMaterializationBatchSize = 200;
  private readonly maxMaterializationIterations = 500;

  private emptyMonths() {
    return Array.from({ length: 12 }, () => 0);
  }

  private sumYear(months: number[]) {
    return months.reduce((acc, value) => acc + value, 0);
  }

  private serializeRecurrence(row: typeof recurrences.$inferSelect) {
    return {
      ...row,
      amount: Number(row.amount),
    };
  }

  private toRecurrenceAuditData(
    row: typeof recurrences.$inferSelect | ReturnType<RecurrenceService["serializeRecurrence"]>,
  ) {
    const serialized =
      typeof (row as { amount?: unknown }).amount === "number"
        ? (row as ReturnType<RecurrenceService["serializeRecurrence"]>)
        : this.serializeRecurrence(row as typeof recurrences.$inferSelect);
    return {
      id: serialized.id,
      originType: serialized.originType,
      status: serialized.status,
      timezone: serialized.timezone,
      frequency: serialized.frequency,
      startDate: serialized.startDate,
      dayOfWeek: serialized.dayOfWeek,
      dayOfMonth: serialized.dayOfMonth,
      monthOfYear: serialized.monthOfYear,
      endType: serialized.endType,
      endOccurrences: serialized.endOccurrences,
      endDate: serialized.endDate,
      accountId: serialized.accountId,
      categoryId: serialized.categoryId,
      subcategoryId: serialized.subcategoryId,
      fromAccountId: serialized.fromAccountId,
      toAccountId: serialized.toAccountId,
      amount: serialized.amount,
      description: serialized.description,
      notes: serialized.notes,
      nextOccurrenceDate: serialized.nextOccurrenceDate,
      lastMaterializedDate: serialized.lastMaterializedDate,
      finalizedAt: serialized.finalizedAt,
      deletedAt: serialized.deletedAt,
      version: serialized.version,
    } as Record<string, unknown>;
  }

  private toIsoDate(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private getFirstOccurrenceForRecurrence(schedule: RecurrenceSchedule) {
    return getFirstOccurrence(schedule);
  }

  private getNextOccurrenceAfterDate(schedule: RecurrenceSchedule, date: string) {
    return getNextOccurrenceAfter(schedule, date);
  }

  private mergeLastMaterializedDate(
    baseDate: string | null | undefined,
    candidateDate: string | null | undefined,
  ) {
    if (!baseDate) return candidateDate ?? null;
    if (!candidateDate) return baseDate;
    return compareIsoDate(candidateDate, baseDate) > 0 ? candidateDate : baseDate;
  }

  private async getLatestMaterializedDate(
    recurrenceId: string,
    executor: DB = this.app.db,
  ): Promise<string | null> {
    const [row] = await executor
      .select({
        latestDate: sql<string | null>`max(${recurrenceOccurrences.occurrenceDate})::text`,
      })
      .from(recurrenceOccurrences)
      .where(
        and(
          eq(recurrenceOccurrences.recurrenceId, recurrenceId),
          eq(recurrenceOccurrences.status, "materialized"),
        ),
      );

    return row?.latestDate ?? null;
  }

  private async getNowIsoDateInTimezone(timezone: string) {
    const result = await this.app.db.execute(
      sql`select to_char((now() at time zone ${timezone})::date, 'YYYY-MM-DD') as today`,
    );

    const rows = Array.isArray(result) ? result : ((result as { rows?: unknown[] }).rows ?? []);
    const firstRow = rows[0] as { today?: string } | undefined;
    const today = firstRow?.today;
    if (!today || !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
      return this.toIsoDate(new Date());
    }
    return today;
  }

  private async ensureUserOwnsAllAccounts(userId: string, accountIds: string[], path: string) {
    if (accountIds.length === 0) return;

    const ownedAccounts = await this.app.db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.userId, userId), inArray(accounts.id, accountIds)));

    if (ownedAccounts.length !== accountIds.length) {
      throw new ForbiddenProblem("Uma ou mais contas informadas não pertencem ao usuário.", path);
    }
  }

  private async getTransferCategoryId() {
    const [category] = await this.app.db
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(
          eq(categories.name, "Transferência"),
          eq(categories.system, true),
          isNull(categories.userId),
        ),
      )
      .limit(1);

    if (!category) {
      throw new NotFoundProblem(
        "Categoria de sistema 'Transferência' não encontrada. Execute o seed do sistema.",
        "/recurrences/materialize",
      );
    }

    return category.id;
  }

  private async ensureAccountOwnership(userId: string, accountId: string, path: string) {
    const [account] = await this.app.db
      .select()
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);

    if (!account) {
      throw new NotFoundProblem("Conta não encontrada.", path);
    }
    if (account.userId !== userId) {
      throw new ForbiddenProblem("Acesso negado à conta.", path);
    }
  }

  private async ensureCategoryOwnership(userId: string, categoryId: string, path: string) {
    const [category] = await this.app.db
      .select()
      .from(categories)
      .where(eq(categories.id, categoryId))
      .limit(1);

    if (!category) {
      throw new NotFoundProblem("Categoria não encontrada.", path);
    }
    if (category.system || category.userId !== userId) {
      throw new ForbiddenProblem("Acesso negado à categoria.", path);
    }
  }

  private async ensureSubcategoryOwnership(
    userId: string,
    subcategoryId: string,
    expectedCategoryId: string | undefined,
    path: string,
  ) {
    const [subcategory] = await this.app.db
      .select()
      .from(subcategories)
      .where(eq(subcategories.id, subcategoryId))
      .limit(1);

    if (!subcategory) {
      throw new NotFoundProblem("Subcategoria não encontrada.", path);
    }
    if (subcategory.userId !== userId) {
      throw new ForbiddenProblem("Acesso negado à subcategoria.", path);
    }
    if (expectedCategoryId && subcategory.categoryId !== expectedCategoryId) {
      throw new ValidationProblem("A subcategoria não pertence à categoria informada.", path);
    }
  }

  private async validatePayloadOwnership(
    userId: string,
    data: CreateRecurrenceInput | UpdateRecurrenceInput,
    baseCategoryId?: string | null,
  ) {
    if (data.accountId) {
      await this.ensureAccountOwnership(userId, data.accountId, "/recurrences");
    }
    if (data.fromAccountId) {
      await this.ensureAccountOwnership(userId, data.fromAccountId, "/recurrences");
    }
    if (data.toAccountId) {
      await this.ensureAccountOwnership(userId, data.toAccountId, "/recurrences");
    }
    if (data.categoryId) {
      await this.ensureCategoryOwnership(userId, data.categoryId, "/recurrences");
    }
    if (data.subcategoryId) {
      const expectedCategoryId = data.categoryId ?? baseCategoryId ?? undefined;
      await this.ensureSubcategoryOwnership(
        userId,
        data.subcategoryId,
        expectedCategoryId,
        "/recurrences",
      );
    }
  }

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

  private async getUserTimezone(userId: string) {
    const [user] = await this.app.db.select().from(users).where(eq(users.id, userId)).limit(1);
    return user?.timezone ?? DEFAULT_TIMEZONE;
  }

  async create(userId: string, data: CreateRecurrenceInput) {
    await this.validatePayloadOwnership(userId, data);
    const timezone = await this.getUserTimezone(userId);

    let nextOccurrenceDate: string;
    try {
      nextOccurrenceDate = this.getFirstOccurrenceForRecurrence({
        startDate: data.startDate,
        frequency: data.frequency,
        dayOfWeek: data.dayOfWeek ?? null,
        dayOfMonth: data.dayOfMonth ?? null,
        monthOfYear: data.monthOfYear ?? null,
      });
    } catch {
      throw new ValidationProblem(
        "Regra de recorrência inválida para cálculo de agenda.",
        "/recurrences",
      );
    }

    const [created] = await this.app.db.transaction(async (tx: DB) => {
      const [inserted] = await tx
        .insert(recurrences)
        .values({
          userId,
          originType: data.originType,
          status: "active",
          timezone,
          frequency: data.frequency,
          startDate: data.startDate,
          dayOfWeek: data.dayOfWeek ?? null,
          dayOfMonth: data.dayOfMonth ?? null,
          monthOfYear: data.monthOfYear ?? null,
          endType: data.endType,
          endOccurrences: data.endOccurrences ?? null,
          endDate: data.endDate ?? null,
          accountId: data.accountId ?? null,
          categoryId: data.categoryId ?? null,
          subcategoryId: data.subcategoryId ?? null,
          fromAccountId: data.fromAccountId ?? null,
          toAccountId: data.toAccountId ?? null,
          amount: data.amount.toString(),
          description: data.description ?? null,
          notes: data.notes ?? null,
          nextOccurrenceDate,
        })
        .returning();

      await this.audit.log(
        {
          userId,
          entityType: "recurrence",
          entityId: inserted.id,
          action: "create",
          beforeData: null,
          afterData: this.toRecurrenceAuditData(inserted),
          metadata: {
            operation: "recurrence-create",
          },
        },
        tx,
      );

      return [inserted];
    });

    return this.serializeRecurrence(created);
  }

  async list(userId: string, query: ListRecurrencesQuery) {
    const filters = [eq(recurrences.userId, userId), sql`${recurrences.deletedAt} IS NULL`];

    if (query.originType) {
      filters.push(eq(recurrences.originType, query.originType));
    }
    if (query.status) {
      filters.push(eq(recurrences.status, query.status));
    }
    if (query.frequency) {
      filters.push(eq(recurrences.frequency, query.frequency));
    }
    if (query.accountId) {
      filters.push(
        or(
          eq(recurrences.accountId, query.accountId),
          eq(recurrences.fromAccountId, query.accountId),
          eq(recurrences.toAccountId, query.accountId),
        )!,
      );
    }
    if (query.q) {
      filters.push(
        or(
          ilike(recurrences.description, `%${query.q}%`),
          ilike(recurrences.notes, `%${query.q}%`),
        )!,
      );
    }

    const whereClause = and(...filters);
    const offset = (query.page - 1) * query.limit;

    const [totalResult] = await this.app.db
      .select({ total: sql<number>`count(*)::int` })
      .from(recurrences)
      .where(whereClause);

    const rows: Array<typeof recurrences.$inferSelect> = await this.app.db
      .select()
      .from(recurrences)
      .where(whereClause)
      .orderBy(desc(recurrences.createdAt))
      .limit(query.limit)
      .offset(offset);

    return {
      data: rows.map((row) => this.serializeRecurrence(row)),
      page: query.page,
      limit: query.limit,
      total: totalResult?.total ?? 0,
    };
  }

  async getOne(userId: string, recurrenceId: string) {
    const [recurrence] = await this.app.db
      .select()
      .from(recurrences)
      .where(and(eq(recurrences.id, recurrenceId), sql`${recurrences.deletedAt} IS NULL`))
      .limit(1);

    if (!recurrence) {
      throw new NotFoundProblem("Recorrência não encontrada.", `/recurrences/${recurrenceId}`);
    }
    if (recurrence.userId !== userId) {
      throw new ForbiddenProblem("Acesso negado à recorrência.", `/recurrences/${recurrenceId}`);
    }

    return this.serializeRecurrence(recurrence);
  }

  async update(userId: string, recurrenceId: string, data: UpdateRecurrenceInput) {
    const existing = await this.getOne(userId, recurrenceId);
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

    await this.validatePayloadOwnership(userId, data, existing.categoryId);

    const latestMaterializedDate = await this.getLatestMaterializedDate(recurrenceId);
    const effectiveLastMaterializedDate = this.mergeLastMaterializedDate(
      existing.lastMaterializedDate,
      latestMaterializedDate,
    );

    const mergedStartDate = data.startDate ?? existing.startDate;
    const mergedEndDate = data.endDate ?? existing.endDate;
    if (mergedEndDate && mergedEndDate < mergedStartDate) {
      throw new ValidationProblem(
        "Data final não pode ser anterior à data de início.",
        `/recurrences/${recurrenceId}`,
      );
    }

    const payload: Partial<typeof recurrences.$inferInsert> = {};
    if (data.frequency !== undefined) payload.frequency = data.frequency;
    if (data.startDate !== undefined) payload.startDate = data.startDate;
    if (data.dayOfWeek !== undefined) payload.dayOfWeek = data.dayOfWeek;
    if (data.dayOfMonth !== undefined) payload.dayOfMonth = data.dayOfMonth;
    if (data.monthOfYear !== undefined) payload.monthOfYear = data.monthOfYear;
    if (data.endType !== undefined) payload.endType = data.endType;
    if (data.endOccurrences !== undefined) payload.endOccurrences = data.endOccurrences;
    if (data.endDate !== undefined) payload.endDate = data.endDate;
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
          ? this.getNextOccurrenceAfterDate(schedule, effectiveLastMaterializedDate)
          : this.getFirstOccurrenceForRecurrence(schedule);
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

      await this.audit.log(
        {
          userId,
          entityType: "recurrence",
          entityId: updatedRow.id,
          action: "update",
          beforeData: this.toRecurrenceAuditData(existing),
          afterData: this.toRecurrenceAuditData(updatedRow),
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

    return this.serializeRecurrence(updated);
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

  private ensureOriginSpecificSingleScopePayload(
    recurrence: Awaited<ReturnType<RecurrenceService["getOne"]>>,
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

  private async applySingleScopeEdit(
    userId: string,
    recurrenceId: string,
    recurrence: Awaited<ReturnType<RecurrenceService["getOne"]>>,
    occurrenceDate: string,
    changes: UpdateRecurrenceInput,
  ) {
    this.ensureSingleScopeAllowedFields(changes);
    this.ensureOriginSpecificSingleScopePayload(recurrence, changes);

    const today = await this.getNowIsoDateInTimezone(recurrence.timezone);
    if (compareIsoDate(occurrenceDate, today) < 0) {
      throw new ValidationProblem(
        "Não é permitido editar ocorrência materializada passada via fluxo de recorrência.",
        `/recurrences/${recurrenceId}`,
      );
    }

    await this.validatePayloadOwnership(userId, changes, recurrence.categoryId);

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
      throw new ValidationProblem(
        "Escopo 'single' exige ocorrência já materializada na data selecionada.",
        `/recurrences/${recurrenceId}`,
      );
    }

    if (recurrence.originType === "transaction") {
      if (!occurrence.transactionId) {
        throw new ValidationProblem(
          "Ocorrência de transação sem vínculo para edição.",
          `/recurrences/${recurrenceId}`,
        );
      }

      const [currentTx] = await this.app.db
        .select({
          id: transactions.id,
          categoryId: transactions.categoryId,
          type: transactions.type,
        })
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

      const payload: Partial<typeof transactions.$inferInsert> = {
        updatedAt: new Date(),
      };

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

      await this.audit.log({
        userId,
        entityType: "recurrence",
        entityId: recurrenceId,
        action: "update",
        beforeData: this.toRecurrenceAuditData(recurrence),
        afterData: this.toRecurrenceAuditData(recurrence),
        metadata: {
          operation: "recurrence-edit-scope-single",
          scope: "single",
          occurrenceDate,
          changes,
        },
      });

      return {
        scope: "single" as const,
        occurrenceDate,
        recurrence: recurrence,
      };
    }

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

    const expenseTx = transferTransactions.find((transferTx) => transferTx.type === "expense");
    const incomeTx = transferTransactions.find((transferTx) => transferTx.type === "income");

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

    const basePayload: Partial<typeof transactions.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (changes.amount !== undefined) basePayload.amount = changes.amount.toString();
    if (changes.description !== undefined) basePayload.description = changes.description;
    if (changes.notes !== undefined) basePayload.notes = changes.notes;

    await this.app.db.transaction(async (tx: DB) => {
      await tx
        .update(transactions)
        .set({
          ...basePayload,
          accountId: changes.fromAccountId ?? undefined,
        })
        .where(and(eq(transactions.id, expenseTx.id), eq(transactions.userId, userId)));

      await tx
        .update(transactions)
        .set({
          ...basePayload,
          accountId: changes.toAccountId ?? undefined,
        })
        .where(and(eq(transactions.id, incomeTx.id), eq(transactions.userId, userId)));
    });

    await this.audit.log({
      userId,
      entityType: "recurrence",
      entityId: recurrenceId,
      action: "update",
      beforeData: this.toRecurrenceAuditData(recurrence),
      afterData: this.toRecurrenceAuditData(recurrence),
      metadata: {
        operation: "recurrence-edit-scope-single",
        scope: "single",
        occurrenceDate,
        changes,
      },
    });

    return {
      scope: "single" as const,
      occurrenceDate,
      recurrence: recurrence,
    };
  }

  private buildCreatePayloadFromRecurrence(
    recurrence: Awaited<ReturnType<RecurrenceService["getOne"]>>,
    changes: UpdateRecurrenceInput,
    startDate: string,
  ): CreateRecurrenceInput {
    const nextSubcategoryId =
      changes.categoryId !== undefined && changes.subcategoryId === undefined
        ? undefined
        : (changes.subcategoryId ?? recurrence.subcategoryId ?? undefined);

    return {
      originType: recurrence.originType,
      frequency: changes.frequency ?? recurrence.frequency,
      startDate,
      dayOfWeek: changes.dayOfWeek ?? recurrence.dayOfWeek ?? undefined,
      dayOfMonth: changes.dayOfMonth ?? recurrence.dayOfMonth ?? undefined,
      monthOfYear: changes.monthOfYear ?? recurrence.monthOfYear ?? undefined,
      endType: changes.endType ?? recurrence.endType,
      endOccurrences: changes.endOccurrences ?? recurrence.endOccurrences ?? undefined,
      endDate: changes.endDate ?? recurrence.endDate ?? undefined,
      accountId: changes.accountId ?? recurrence.accountId ?? undefined,
      categoryId: changes.categoryId ?? recurrence.categoryId ?? undefined,
      subcategoryId: nextSubcategoryId,
      fromAccountId: changes.fromAccountId ?? recurrence.fromAccountId ?? undefined,
      toAccountId: changes.toAccountId ?? recurrence.toAccountId ?? undefined,
      amount: changes.amount ?? recurrence.amount,
      description: changes.description ?? recurrence.description ?? undefined,
      notes: changes.notes ?? recurrence.notes ?? undefined,
    };
  }

  async editByScope(userId: string, recurrenceId: string, input: EditRecurrenceByScopeInput) {
    const recurrence = await this.getOne(userId, recurrenceId);
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

    const latestMaterializedDate = await this.getLatestMaterializedDate(recurrenceId);
    const effectiveLastMaterializedDate = this.mergeLastMaterializedDate(
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
    const createPayload = this.buildCreatePayloadFromRecurrence(
      recurrence,
      { ...changes, expectedVersion: undefined },
      targetOccurrenceDate,
    );
    const validatedCreatePayload = createRecurrenceSchema.parse(createPayload);
    await this.validatePayloadOwnership(userId, validatedCreatePayload, recurrence.categoryId);

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
      const txLatestMaterializedDate = await this.getLatestMaterializedDate(recurrenceId, tx);
      const txEffectiveLastMaterializedDate = this.mergeLastMaterializedDate(
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
        nextOccurrenceDate = this.getFirstOccurrenceForRecurrence({
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

      await this.audit.log(
        {
          userId,
          entityType: "recurrence",
          entityId: closedRecurrence.id,
          action: "update",
          beforeData: this.toRecurrenceAuditData(current),
          afterData: this.toRecurrenceAuditData(closedRecurrence),
          metadata: {
            operation: "recurrence-edit-scope-this-and-next-close",
            scope: "this_and_next",
            occurrenceDate: targetOccurrenceDate,
          },
        },
        tx,
      );

      await this.audit.log(
        {
          userId,
          entityType: "recurrence",
          entityId: createdRecurrence.id,
          action: "create",
          beforeData: null,
          afterData: this.toRecurrenceAuditData(createdRecurrence),
          metadata: {
            operation: "recurrence-edit-scope-this-and-next-create",
            scope: "this_and_next",
            occurrenceDate: targetOccurrenceDate,
          },
        },
        tx,
      );

      return [
        this.serializeRecurrence(closedRecurrence),
        this.serializeRecurrence(createdRecurrence),
      ];
    });

    return {
      scope: "this_and_next" as const,
      previousRecurrence,
      newRecurrence,
    };
  }

  async finalize(userId: string, recurrenceId: string) {
    const existing = await this.getOne(userId, recurrenceId);

    if (existing.status === "finalized") {
      return existing;
    }

    const [updated] = await this.app.db.transaction(async (tx: DB) => {
      const [updatedRow] = await tx
        .update(recurrences)
        .set({
          status: "finalized",
          finalizedAt: new Date(),
          updatedAt: new Date(),
          version: existing.version + 1,
        })
        .where(eq(recurrences.id, recurrenceId))
        .returning();

      await this.audit.log(
        {
          userId,
          entityType: "recurrence",
          entityId: updatedRow.id,
          action: "update",
          beforeData: this.toRecurrenceAuditData(existing),
          afterData: this.toRecurrenceAuditData(updatedRow),
          metadata: {
            operation: "recurrence-finalize",
          },
        },
        tx,
      );

      return [updatedRow];
    });

    return this.serializeRecurrence(updated);
  }

  async remove(userId: string, recurrenceId: string) {
    const existing = await this.getOne(userId, recurrenceId);

    if (existing.status === "active") {
      throw new ValidationProblem(
        "Recorrência ativa não pode ser excluída. Finalize antes de excluir.",
        `/recurrences/${recurrenceId}`,
      );
    }

    await this.app.db.transaction(async (tx: DB) => {
      const [deletedRow] = await tx
        .update(recurrences)
        .set({
          deletedAt: new Date(),
          updatedAt: new Date(),
          version: existing.version + 1,
        })
        .where(eq(recurrences.id, recurrenceId))
        .returning();

      await this.audit.log(
        {
          userId,
          entityType: "recurrence",
          entityId: recurrenceId,
          action: "delete",
          beforeData: this.toRecurrenceAuditData(existing),
          afterData: this.toRecurrenceAuditData(deletedRow),
          metadata: {
            operation: "recurrence-delete",
          },
        },
        tx,
      );
    });

    return { message: "Recorrência removida com sucesso." };
  }

  private async materializeTransactionOccurrence(
    tx: DB,
    recurrence: typeof recurrences.$inferSelect,
    occurrenceDate: string,
  ) {
    if (!recurrence.accountId || !recurrence.categoryId) {
      throw new ValidationProblem(
        "Recorrência de transação inválida: conta e categoria são obrigatórias.",
        "/recurrences/materialize",
      );
    }

    const [category] = await tx
      .select({ type: categories.type })
      .from(categories)
      .where(eq(categories.id, recurrence.categoryId))
      .limit(1);

    if (!category) {
      throw new ValidationProblem(
        "Categoria da recorrência não encontrada para materialização.",
        "/recurrences/materialize",
      );
    }

    const [createdTx] = await tx
      .insert(transactions)
      .values({
        userId: recurrence.userId,
        accountId: recurrence.accountId,
        categoryId: recurrence.categoryId,
        subcategoryId: recurrence.subcategoryId,
        type: category.type,
        amount: recurrence.amount,
        date: occurrenceDate,
        description: recurrence.description,
        notes: recurrence.notes,
      })
      .returning({ id: transactions.id });

    return { transactionId: createdTx.id, transferId: null as string | null };
  }

  private async materializeTransferOccurrence(
    tx: DB,
    recurrence: typeof recurrences.$inferSelect,
    occurrenceDate: string,
    transferCategoryId: string,
  ) {
    if (!recurrence.fromAccountId || !recurrence.toAccountId) {
      throw new ValidationProblem(
        "Recorrência de transferência inválida: contas de origem e destino são obrigatórias.",
        "/recurrences/materialize",
      );
    }

    if (recurrence.fromAccountId === recurrence.toAccountId) {
      throw new ValidationProblem(
        "Recorrência de transferência inválida: origem e destino não podem ser iguais.",
        "/recurrences/materialize",
      );
    }

    const transferId = randomUUID();

    await tx.insert(transactions).values([
      {
        userId: recurrence.userId,
        accountId: recurrence.fromAccountId,
        categoryId: transferCategoryId,
        type: "expense",
        amount: recurrence.amount,
        date: occurrenceDate,
        description: recurrence.description,
        notes: recurrence.notes,
        transferId,
      },
      {
        userId: recurrence.userId,
        accountId: recurrence.toAccountId,
        categoryId: transferCategoryId,
        type: "income",
        amount: recurrence.amount,
        date: occurrenceDate,
        description: recurrence.description,
        notes: recurrence.notes,
        transferId,
      },
    ]);

    return { transactionId: null as string | null, transferId };
  }

  async materialize(userId: string, input: MaterializeRecurrencesInput) {
    const todayByTimezone = new Map<string, string>();
    let transferCategoryId: string | null = null;
    const batchSize = input.maxRecurrences ?? this.defaultMaterializationBatchSize;

    const [activeCountResult] = await this.app.db
      .select({ total: sql<number>`count(*)::int` })
      .from(recurrences)
      .where(
        and(
          eq(recurrences.userId, userId),
          eq(recurrences.status, "active"),
          sql`${recurrences.deletedAt} IS NULL`,
        ),
      );
    const totalActive = activeCountResult?.total ?? 0;

    const activeRecurrences = await this.app.db
      .select()
      .from(recurrences)
      .where(
        and(
          eq(recurrences.userId, userId),
          eq(recurrences.status, "active"),
          sql`${recurrences.deletedAt} IS NULL`,
        ),
      )
      .orderBy(asc(recurrences.createdAt))
      .limit(batchSize);

    let createdOccurrences = 0;
    let skippedOccurrences = 0;
    let createdTransactions = 0;
    let createdTransfers = 0;
    let finalizedRecurrences = 0;
    let failedRecurrences = 0;

    for (const recurrence of activeRecurrences) {
      const schedule: RecurrenceSchedule = {
        startDate: recurrence.startDate,
        frequency: recurrence.frequency,
        dayOfWeek: recurrence.dayOfWeek,
        dayOfMonth: recurrence.dayOfMonth,
        monthOfYear: recurrence.monthOfYear,
      };
      let untilDate = input.untilDate;
      if (!untilDate) {
        const cachedToday = todayByTimezone.get(recurrence.timezone);
        if (cachedToday) {
          untilDate = cachedToday;
        } else {
          untilDate = await this.getNowIsoDateInTimezone(recurrence.timezone);
          todayByTimezone.set(recurrence.timezone, untilDate);
        }
      }
      let cursorDate = recurrence.nextOccurrenceDate ?? recurrence.startDate;

      let localCreated = 0;
      let localSkipped = 0;
      let localTransactions = 0;
      let localTransfers = 0;
      let localFirstProcessedDate: string | null = null;
      let localLastMaterializedDate: string | null = null;
      let shouldFinalize = false;
      let iterations = 0;
      let updatedRecurrenceSnapshot: typeof recurrences.$inferSelect | null = null;

      try {
        if (compareIsoDate(cursorDate, recurrence.startDate) < 0) {
          cursorDate = recurrence.startDate;
        }
        cursorDate = getFirstOccurrenceOnOrAfter(schedule, cursorDate);

        let materializedCount = 0;
        if (recurrence.endType === "by_occurrences" && recurrence.endOccurrences) {
          const [countResult] = await this.app.db
            .select({ total: sql<number>`count(*)::int` })
            .from(recurrenceOccurrences)
            .where(
              and(
                eq(recurrenceOccurrences.recurrenceId, recurrence.id),
                eq(recurrenceOccurrences.status, "materialized"),
              ),
            );
          materializedCount = countResult?.total ?? 0;
        }

        while (compareIsoDate(cursorDate, untilDate) <= 0) {
          iterations += 1;
          if (!localFirstProcessedDate) {
            localFirstProcessedDate = cursorDate;
          }
          if (iterations > this.maxMaterializationIterations) {
            throw new ValidationProblem(
              "Limite de materialização por recorrência excedido nesta execução.",
              "/recurrences/materialize",
            );
          }

          if (recurrence.endType === "until_date" && recurrence.endDate) {
            if (compareIsoDate(cursorDate, recurrence.endDate) > 0) {
              shouldFinalize = true;
              break;
            }
          }

          if (recurrence.endType === "by_occurrences" && recurrence.endOccurrences) {
            if (materializedCount >= recurrence.endOccurrences) {
              shouldFinalize = true;
              break;
            }
          }

          const occurrenceOutcome = await this.app.db.transaction(async (tx: DB) => {
            const [occurrence] = await tx
              .insert(recurrenceOccurrences)
              .values({
                recurrenceId: recurrence.id,
                originType: recurrence.originType,
                occurrenceDate: cursorDate,
                status: "materialized",
              })
              .onConflictDoNothing({
                target: [
                  recurrenceOccurrences.recurrenceId,
                  recurrenceOccurrences.occurrenceDate,
                  recurrenceOccurrences.originType,
                ],
              })
              .returning({ id: recurrenceOccurrences.id });

            if (!occurrence) {
              return {
                inserted: false,
                transactionId: null as string | null,
                transferId: null as string | null,
              };
            }

            if (recurrence.originType === "transaction") {
              const transactionResult = await this.materializeTransactionOccurrence(
                tx,
                recurrence,
                cursorDate,
              );

              await tx
                .update(recurrenceOccurrences)
                .set({
                  transactionId: transactionResult.transactionId,
                  metadata: { source: "recurrence-materialization" },
                })
                .where(eq(recurrenceOccurrences.id, occurrence.id));

              return { inserted: true, ...transactionResult };
            }

            if (!transferCategoryId) {
              transferCategoryId = await this.getTransferCategoryId();
            }
            const ensuredTransferCategoryId = transferCategoryId as string;

            const transferResult = await this.materializeTransferOccurrence(
              tx,
              recurrence,
              cursorDate,
              ensuredTransferCategoryId,
            );

            await tx
              .update(recurrenceOccurrences)
              .set({
                transferId: transferResult.transferId,
                metadata: { source: "recurrence-materialization" },
              })
              .where(eq(recurrenceOccurrences.id, occurrence.id));

            return { inserted: true, ...transferResult };
          });

          if (occurrenceOutcome.inserted) {
            localCreated += 1;
            localLastMaterializedDate = cursorDate;
            if (occurrenceOutcome.transactionId) {
              localTransactions += 1;
            }
            if (occurrenceOutcome.transferId) {
              localTransfers += 1;
            }
            if (recurrence.endType === "by_occurrences" && recurrence.endOccurrences) {
              materializedCount += 1;
            }
          } else {
            localSkipped += 1;
            localLastMaterializedDate = cursorDate;
          }

          cursorDate = getNextOccurrenceAfter(schedule, cursorDate);
        }
      } catch (error) {
        this.app.log.error(
          {
            recurrenceId: recurrence.id,
            userId: recurrence.userId,
            originType: recurrence.originType,
            cursorDate,
            error,
          },
          "Recurrence materialization failed",
        );

        failedRecurrences += 1;
        continue;
      }

      let currentVersion = recurrence.version;
      let updateApplied = false;
      let retries = 0;

      while (retries < 3) {
        const [current] = await this.app.db
          .select({
            id: recurrences.id,
            status: recurrences.status,
            version: recurrences.version,
            nextOccurrenceDate: recurrences.nextOccurrenceDate,
            lastMaterializedDate: recurrences.lastMaterializedDate,
          })
          .from(recurrences)
          .where(
            and(
              eq(recurrences.id, recurrence.id),
              eq(recurrences.userId, userId),
              sql`${recurrences.deletedAt} IS NULL`,
            ),
          )
          .limit(1);

        if (!current || current.status !== "active") {
          break;
        }

        currentVersion = current.version;

        const mergedLastMaterializedDate =
          localLastMaterializedDate &&
          (!current.lastMaterializedDate ||
            compareIsoDate(localLastMaterializedDate, current.lastMaterializedDate) > 0)
            ? localLastMaterializedDate
            : current.lastMaterializedDate;

        const mergedNextOccurrenceDate = shouldFinalize
          ? null
          : current.nextOccurrenceDate && compareIsoDate(current.nextOccurrenceDate, cursorDate) > 0
            ? current.nextOccurrenceDate
            : cursorDate;

        const updatePayload: Partial<typeof recurrences.$inferInsert> = {
          nextOccurrenceDate: mergedNextOccurrenceDate,
          updatedAt: new Date(),
          version: currentVersion + 1,
        };

        if (mergedLastMaterializedDate) {
          updatePayload.lastMaterializedDate = mergedLastMaterializedDate;
          updatePayload.lastMaterializedAt = new Date();
        }

        if (shouldFinalize) {
          updatePayload.status = "finalized";
          updatePayload.finalizedAt = new Date();
        }

        const [updatedRecurrence] = await this.app.db
          .update(recurrences)
          .set(updatePayload)
          .where(and(eq(recurrences.id, recurrence.id), eq(recurrences.version, currentVersion)))
          .returning();

        if (updatedRecurrence) {
          updatedRecurrenceSnapshot = updatedRecurrence;
          updateApplied = true;
          if (shouldFinalize) {
            finalizedRecurrences += 1;
          }
          break;
        }

        retries += 1;
      }

      if (!updateApplied) {
        this.app.log.warn(
          { recurrenceId: recurrence.id, userId: recurrence.userId },
          "Skipping recurrence state update due to concurrent version change",
        );
      } else if (
        updatedRecurrenceSnapshot &&
        (localCreated > 0 || localSkipped > 0 || shouldFinalize)
      ) {
        await this.audit.log({
          userId: recurrence.userId,
          entityType: "recurrence",
          entityId: recurrence.id,
          action: "update",
          beforeData: this.toRecurrenceAuditData(recurrence),
          afterData: this.toRecurrenceAuditData(updatedRecurrenceSnapshot),
          metadata: {
            operation: "recurrence-materialize",
            fromDate: localFirstProcessedDate,
            toDate: localLastMaterializedDate ?? cursorDate,
            createdOccurrences: localCreated,
            skippedOccurrences: localSkipped,
            createdTransactions: localTransactions,
            createdTransfers: localTransfers,
            finalized: shouldFinalize,
          },
        });
      }

      createdOccurrences += localCreated;
      skippedOccurrences += localSkipped;
      createdTransactions += localTransactions;
      createdTransfers += localTransfers;
    }

    return {
      totalActiveRecurrences: totalActive,
      processedRecurrences: activeRecurrences.length,
      truncatedByBatch: totalActive > activeRecurrences.length,
      remainingRecurrences: Math.max(0, totalActive - activeRecurrences.length),
      createdOccurrences,
      skippedOccurrences,
      createdTransactions,
      createdTransfers,
      finalizedRecurrences,
      failedRecurrences,
    };
  }

  async forecast(userId: string, query: RecurrencesForecastQuery) {
    const [user] = await this.app.db
      .select({ timezone: users.timezone })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundProblem("Usuário não encontrado.", "/recurrences/forecast");
    }

    const accountIds = query.accountIds ?? [];
    await this.ensureUserOwnsAllAccounts(userId, accountIds, "/recurrences/forecast");
    const accountSet = new Set(accountIds);

    const today = await this.getNowIsoDateInTimezone(user.timezone ?? DEFAULT_TIMEZONE);
    const currentYear = Number(today.slice(0, 4));
    const year = query.year ?? currentYear;
    const yearStartDate = `${year}-01-01`;
    const yearEndDate = `${year}-12-31`;
    const projectionStartDate =
      year < currentYear
        ? null
        : year === currentYear && compareIsoDate(today, yearStartDate) > 0
          ? today
          : yearStartDate;

    const real = {
      income: { months: this.emptyMonths(), yearTotal: 0 },
      expense: { months: this.emptyMonths(), yearTotal: 0 },
    };
    const projected = {
      income: { months: this.emptyMonths(), yearTotal: 0 },
      expense: { months: this.emptyMonths(), yearTotal: 0 },
    };

    const realFilters = [
      eq(transactions.userId, userId),
      gte(transactions.date, yearStartDate),
      lte(transactions.date, yearEndDate),
    ];
    if (accountIds.length > 0) {
      realFilters.push(inArray(transactions.accountId, accountIds));
    }

    const realRows: Array<{ type: "income" | "expense"; month: number; total: string }> =
      await this.app.db
        .select({
          type: transactions.type,
          month: sql<number>`extract(month from ${transactions.date}::date)::int`,
          total: sql<string>`sum(${transactions.amount})::text`,
        })
        .from(transactions)
        .where(and(...realFilters))
        .groupBy(transactions.type, sql`extract(month from ${transactions.date}::date)`);

    for (const row of realRows) {
      if (row.type !== "income" && row.type !== "expense") continue;
      const monthIndex = Math.max(0, Math.min(11, Number(row.month) - 1));
      const amount = Number(row.total);
      if (!Number.isFinite(amount)) continue;
      real[row.type].months[monthIndex] += amount;
    }

    let projectedOccurrences = 0;

    if (projectionStartDate) {
      const recurrenceFilters = [
        eq(recurrences.userId, userId),
        eq(recurrences.status, "active"),
        sql`${recurrences.deletedAt} IS NULL`,
      ];
      if (accountIds.length > 0) {
        recurrenceFilters.push(
          or(
            inArray(recurrences.accountId, accountIds),
            inArray(recurrences.fromAccountId, accountIds),
            inArray(recurrences.toAccountId, accountIds),
          )!,
        );
      }

      const activeRecurrences: Array<typeof recurrences.$inferSelect> = await this.app.db
        .select()
        .from(recurrences)
        .where(and(...recurrenceFilters))
        .orderBy(asc(recurrences.createdAt));

      const recurrenceIds: string[] = activeRecurrences.map((recurrence) => recurrence.id);
      const materializedCountByRecurrence = new Map<string, number>();
      const materializedDateSet = new Set<string>();

      if (recurrenceIds.length > 0) {
        const counts = await this.app.db
          .select({
            recurrenceId: recurrenceOccurrences.recurrenceId,
            total: sql<number>`count(*)::int`,
          })
          .from(recurrenceOccurrences)
          .where(
            and(
              inArray(recurrenceOccurrences.recurrenceId, recurrenceIds),
              eq(recurrenceOccurrences.status, "materialized"),
            ),
          )
          .groupBy(recurrenceOccurrences.recurrenceId);

        for (const item of counts) {
          materializedCountByRecurrence.set(item.recurrenceId, item.total ?? 0);
        }

        const materializedRows = await this.app.db
          .select({
            recurrenceId: recurrenceOccurrences.recurrenceId,
            occurrenceDate: recurrenceOccurrences.occurrenceDate,
          })
          .from(recurrenceOccurrences)
          .where(
            and(
              inArray(recurrenceOccurrences.recurrenceId, recurrenceIds),
              eq(recurrenceOccurrences.status, "materialized"),
              gte(recurrenceOccurrences.occurrenceDate, projectionStartDate),
              lte(recurrenceOccurrences.occurrenceDate, yearEndDate),
            ),
          );

        for (const row of materializedRows) {
          materializedDateSet.add(`${row.recurrenceId}:${row.occurrenceDate}`);
        }
      }

      const transactionCategoryIds: string[] = Array.from(
        new Set(
          activeRecurrences
            .filter(
              (recurrence) =>
                recurrence.originType === "transaction" && recurrence.categoryId !== null,
            )
            .map((recurrence) => recurrence.categoryId as string),
        ),
      );

      const categoryTypeById = new Map<string, "income" | "expense">();
      if (transactionCategoryIds.length > 0) {
        const categoryRows = await this.app.db
          .select({ id: categories.id, type: categories.type })
          .from(categories)
          .where(inArray(categories.id, transactionCategoryIds));

        for (const row of categoryRows) {
          categoryTypeById.set(row.id, row.type);
        }
      }

      for (const recurrence of activeRecurrences) {
        const schedule: RecurrenceSchedule = {
          startDate: recurrence.startDate,
          frequency: recurrence.frequency,
          dayOfWeek: recurrence.dayOfWeek,
          dayOfMonth: recurrence.dayOfMonth,
          monthOfYear: recurrence.monthOfYear,
        };

        let cursorDate = recurrence.nextOccurrenceDate ?? recurrence.startDate;
        if (compareIsoDate(cursorDate, recurrence.startDate) < 0) {
          cursorDate = recurrence.startDate;
        }

        try {
          cursorDate = getFirstOccurrenceOnOrAfter(schedule, cursorDate);
        } catch {
          continue;
        }

        if (compareIsoDate(cursorDate, projectionStartDate) < 0) {
          try {
            cursorDate = getFirstOccurrenceOnOrAfter(schedule, projectionStartDate);
          } catch {
            continue;
          }
        }

        let remainingOccurrences = Number.POSITIVE_INFINITY;
        if (recurrence.endType === "by_occurrences" && recurrence.endOccurrences) {
          const materializedCount = materializedCountByRecurrence.get(recurrence.id) ?? 0;
          remainingOccurrences = recurrence.endOccurrences - materializedCount;
          if (remainingOccurrences <= 0) continue;
        }

        let iterations = 0;
        while (compareIsoDate(cursorDate, yearEndDate) <= 0) {
          iterations += 1;
          if (iterations > this.maxMaterializationIterations) {
            break;
          }

          if (recurrence.endType === "until_date" && recurrence.endDate) {
            if (compareIsoDate(cursorDate, recurrence.endDate) > 0) {
              break;
            }
          }

          if (remainingOccurrences <= 0) {
            break;
          }

          const occurrenceKey = `${recurrence.id}:${cursorDate}`;
          if (!materializedDateSet.has(occurrenceKey)) {
            const monthIndex = Math.max(0, Math.min(11, Number(cursorDate.slice(5, 7)) - 1));
            const amount = Number(recurrence.amount);
            let counted = false;

            if (recurrence.originType === "transaction") {
              if (recurrence.accountId && recurrence.categoryId) {
                const includeByAccount =
                  accountSet.size === 0 || accountSet.has(recurrence.accountId);
                const transactionType = categoryTypeById.get(recurrence.categoryId);
                if (includeByAccount && transactionType && Number.isFinite(amount)) {
                  projected[transactionType].months[monthIndex] += amount;
                  counted = true;
                }
              }
            } else if (recurrence.fromAccountId && recurrence.toAccountId) {
              const includeExpense =
                accountSet.size === 0 || accountSet.has(recurrence.fromAccountId);
              const includeIncome = accountSet.size === 0 || accountSet.has(recurrence.toAccountId);

              if (includeExpense && Number.isFinite(amount)) {
                projected.expense.months[monthIndex] += amount;
                counted = true;
              }
              if (includeIncome && Number.isFinite(amount)) {
                projected.income.months[monthIndex] += amount;
                counted = true;
              }
            }

            if (recurrence.endType === "by_occurrences" && Number.isFinite(remainingOccurrences)) {
              remainingOccurrences -= 1;
            }

            if (counted) {
              projectedOccurrences += 1;
            }
          }

          try {
            cursorDate = getNextOccurrenceAfter(schedule, cursorDate);
          } catch {
            break;
          }
        }
      }
    }

    real.income.yearTotal = Number(this.sumYear(real.income.months));
    real.expense.yearTotal = Number(this.sumYear(real.expense.months));
    projected.income.yearTotal = Number(this.sumYear(projected.income.months));
    projected.expense.yearTotal = Number(this.sumYear(projected.expense.months));

    const combinedIncomeMonths = real.income.months.map(
      (value, index) => Number(value) + Number(projected.income.months[index]),
    );
    const combinedExpenseMonths = real.expense.months.map(
      (value, index) => Number(value) + Number(projected.expense.months[index]),
    );
    const realBalanceMonths = real.income.months.map(
      (value, index) => Number(value) - Number(real.expense.months[index]),
    );
    const projectedBalanceMonths = projected.income.months.map(
      (value, index) => Number(value) - Number(projected.expense.months[index]),
    );
    const combinedBalanceMonths = combinedIncomeMonths.map(
      (value, index) => Number(value) - Number(combinedExpenseMonths[index]),
    );

    return {
      year,
      timezone: user.timezone ?? DEFAULT_TIMEZONE,
      accountIds,
      horizon: {
        projectionStartDate,
        projectionEndDate: yearEndDate,
      },
      totals: {
        real: {
          income: {
            months: real.income.months,
            yearTotal: real.income.yearTotal,
          },
          expense: {
            months: real.expense.months,
            yearTotal: real.expense.yearTotal,
          },
          balance: {
            months: realBalanceMonths,
            yearTotal: Number(this.sumYear(realBalanceMonths)),
          },
        },
        projected: {
          income: {
            months: projected.income.months,
            yearTotal: projected.income.yearTotal,
          },
          expense: {
            months: projected.expense.months,
            yearTotal: projected.expense.yearTotal,
          },
          balance: {
            months: projectedBalanceMonths,
            yearTotal: Number(this.sumYear(projectedBalanceMonths)),
          },
        },
        combined: {
          income: {
            months: combinedIncomeMonths,
            yearTotal: Number(this.sumYear(combinedIncomeMonths)),
          },
          expense: {
            months: combinedExpenseMonths,
            yearTotal: Number(this.sumYear(combinedExpenseMonths)),
          },
          balance: {
            months: combinedBalanceMonths,
            yearTotal: Number(this.sumYear(combinedBalanceMonths)),
          },
        },
      },
      metadata: {
        projectedOccurrences,
      },
    };
  }
}
