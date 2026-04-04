import { randomUUID } from "crypto";
import { and, asc, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import {
  ConflictProblem,
  ForbiddenProblem,
  NotFoundProblem,
  ValidationProblem,
} from "../../core/errors/problems";
import type { DB } from "../../core/plugins/drizzle";
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
import type {
  CreateRecurrenceInput,
  ListRecurrencesQuery,
  MaterializeRecurrencesInput,
  UpdateRecurrenceInput,
} from "./recurrence.schemas";

export class RecurrenceService {
  constructor(private app: FastifyInstance) {}

  private readonly maxMaterializationIterations = 500;
  private readonly maxSchedulingIterations = 1000;

  private serializeRecurrence(row: typeof recurrences.$inferSelect) {
    return {
      ...row,
      amount: Number(row.amount),
    };
  }

  private toIsoDate(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private parseIsoDate(dateString: string) {
    const [year, month, day] = dateString.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }

  private getDaysInMonth(year: number, monthIndex: number) {
    return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  }

  private addDays(dateString: string, days: number) {
    const date = this.parseIsoDate(dateString);
    date.setUTCDate(date.getUTCDate() + days);
    return this.toIsoDate(date);
  }

  private addMonths(dateString: string, months: number, preferredDay?: number) {
    const date = this.parseIsoDate(dateString);
    const sourceDay = preferredDay ?? date.getUTCDate();
    const sourceMonthIndex = date.getUTCMonth();
    const targetMonthIndex = sourceMonthIndex + months;
    const targetYear = date.getUTCFullYear() + Math.floor(targetMonthIndex / 12);
    const normalizedTargetMonthIndex = ((targetMonthIndex % 12) + 12) % 12;
    const maxDay = this.getDaysInMonth(targetYear, normalizedTargetMonthIndex);
    const day = Math.min(sourceDay, maxDay);
    return this.toIsoDate(new Date(Date.UTC(targetYear, normalizedTargetMonthIndex, day)));
  }

  private addYears(
    dateString: string,
    years: number,
    preferredMonth?: number,
    preferredDay?: number,
  ) {
    const date = this.parseIsoDate(dateString);
    const targetYear = date.getUTCFullYear() + years;
    const month = (preferredMonth ?? date.getUTCMonth() + 1) - 1;
    const sourceDay = preferredDay ?? date.getUTCDate();
    const maxDay = this.getDaysInMonth(targetYear, month);
    const day = Math.min(sourceDay, maxDay);
    return this.toIsoDate(new Date(Date.UTC(targetYear, month, day)));
  }

  private compareIsoDate(a: string, b: string) {
    return a.localeCompare(b);
  }

  private diffDays(fromDate: string, toDate: string) {
    const from = this.parseIsoDate(fromDate).getTime();
    const to = this.parseIsoDate(toDate).getTime();
    return Math.floor((to - from) / (24 * 60 * 60 * 1000));
  }

  private getScheduleStartDateForWeeklyRule(
    startDate: string,
    frequency: "weekly" | "biweekly",
    dayOfWeek: number,
  ) {
    const start = this.parseIsoDate(startDate);
    const startDay = start.getUTCDay();
    const delta = (dayOfWeek - startDay + 7) % 7;
    const aligned = this.addDays(startDate, delta);
    if (frequency === "weekly") return aligned;
    return aligned;
  }

  private getFirstOccurrenceOnOrAfter(
    recurrence: Pick<
      typeof recurrences.$inferSelect,
      "startDate" | "frequency" | "dayOfWeek" | "dayOfMonth" | "monthOfYear"
    >,
    anchorDate: string,
  ) {
    const startDate = recurrence.startDate;
    const anchor = this.compareIsoDate(anchorDate, startDate) < 0 ? startDate : anchorDate;

    if (recurrence.frequency === "weekly" || recurrence.frequency === "biweekly") {
      const dayOfWeek = recurrence.dayOfWeek ?? this.parseIsoDate(startDate).getUTCDay();
      const seriesStart = this.getScheduleStartDateForWeeklyRule(
        startDate,
        recurrence.frequency,
        dayOfWeek,
      );

      if (this.compareIsoDate(anchor, seriesStart) <= 0) {
        return seriesStart;
      }

      const intervalDays = recurrence.frequency === "weekly" ? 7 : 14;
      const daysSinceStart = this.diffDays(seriesStart, anchor);
      const steps = Math.ceil(daysSinceStart / intervalDays);
      return this.addDays(seriesStart, steps * intervalDays);
    }

    if (recurrence.frequency === "monthly") {
      const day = recurrence.dayOfMonth ?? this.parseIsoDate(startDate).getUTCDate();
      let candidate = this.addMonths(
        this.toIsoDate(
          new Date(
            Date.UTC(
              this.parseIsoDate(startDate).getUTCFullYear(),
              this.parseIsoDate(startDate).getUTCMonth(),
              1,
            ),
          ),
        ),
        0,
        day,
      );
      if (this.compareIsoDate(candidate, startDate) < 0) {
        candidate = this.addMonths(candidate, 1, day);
      }

      let guard = 0;
      while (this.compareIsoDate(candidate, anchor) < 0) {
        candidate = this.addMonths(candidate, 1, day);
        guard += 1;
        if (guard > this.maxSchedulingIterations) {
          throw new ValidationProblem(
            "Não foi possível calcular a próxima ocorrência mensal.",
            "/recurrences",
          );
        }
      }
      return candidate;
    }

    const start = this.parseIsoDate(startDate);
    const month = recurrence.monthOfYear ?? start.getUTCMonth() + 1;
    const day = recurrence.dayOfMonth ?? start.getUTCDate();
    let candidate = this.toIsoDate(
      new Date(Date.UTC(start.getUTCFullYear(), month - 1, Math.min(day, 28))),
    );
    candidate = this.addYears(candidate, 0, month, day);
    if (this.compareIsoDate(candidate, startDate) < 0) {
      candidate = this.addYears(candidate, 1, month, day);
    }

    let guard = 0;
    while (this.compareIsoDate(candidate, anchor) < 0) {
      candidate = this.addYears(candidate, 1, month, day);
      guard += 1;
      if (guard > this.maxSchedulingIterations) {
        throw new ValidationProblem(
          "Não foi possível calcular a próxima ocorrência anual.",
          "/recurrences",
        );
      }
    }

    return candidate;
  }

  private getFirstOccurrenceForRecurrence(
    recurrence: Pick<
      typeof recurrences.$inferSelect,
      "startDate" | "frequency" | "dayOfWeek" | "dayOfMonth" | "monthOfYear"
    >,
  ) {
    return this.getFirstOccurrenceOnOrAfter(recurrence, recurrence.startDate);
  }

  private getNextOccurrenceAfterDate(
    recurrence: Pick<
      typeof recurrences.$inferSelect,
      "startDate" | "frequency" | "dayOfWeek" | "dayOfMonth" | "monthOfYear"
    >,
    date: string,
  ) {
    const anchor = this.addDays(date, 1);
    return this.getFirstOccurrenceOnOrAfter(recurrence, anchor);
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

  private calculateNextOccurrenceDate(
    recurrence: typeof recurrences.$inferSelect,
    currentDate: string,
  ) {
    if (recurrence.frequency === "weekly") {
      return this.addDays(currentDate, 7);
    }
    if (recurrence.frequency === "biweekly") {
      return this.addDays(currentDate, 14);
    }
    if (recurrence.frequency === "monthly") {
      return this.addMonths(currentDate, 1, recurrence.dayOfMonth ?? undefined);
    }
    return this.addYears(
      currentDate,
      1,
      recurrence.monthOfYear ?? undefined,
      recurrence.dayOfMonth ?? undefined,
    );
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

  private async getUserTimezone(userId: string) {
    const [user] = await this.app.db.select().from(users).where(eq(users.id, userId)).limit(1);
    return user?.timezone ?? DEFAULT_TIMEZONE;
  }

  async create(userId: string, data: CreateRecurrenceInput) {
    await this.validatePayloadOwnership(userId, data);
    const timezone = await this.getUserTimezone(userId);

    const [created] = await this.app.db
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
        nextOccurrenceDate: this.getFirstOccurrenceForRecurrence({
          startDate: data.startDate,
          frequency: data.frequency,
          dayOfWeek: data.dayOfWeek ?? null,
          dayOfMonth: data.dayOfMonth ?? null,
          monthOfYear: data.monthOfYear ?? null,
        }),
      })
      .returning();

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

      payload.nextOccurrenceDate = existing.lastMaterializedDate
        ? this.getNextOccurrenceAfterDate(schedule, existing.lastMaterializedDate)
        : this.getFirstOccurrenceForRecurrence(schedule);
    }

    payload.version = existing.version + 1;
    payload.updatedAt = new Date();

    const [updated] = await this.app.db
      .update(recurrences)
      .set(payload)
      .where(and(eq(recurrences.id, recurrenceId), eq(recurrences.version, existing.version)))
      .returning();

    if (!updated) {
      throw new ConflictProblem(
        "A recorrência foi alterada por outra sessão. Recarregue e tente novamente.",
        `/recurrences/${recurrenceId}`,
      );
    }

    return this.serializeRecurrence(updated);
  }

  async finalize(userId: string, recurrenceId: string) {
    const existing = await this.getOne(userId, recurrenceId);

    if (existing.status === "finalized") {
      return existing;
    }

    const [updated] = await this.app.db
      .update(recurrences)
      .set({
        status: "finalized",
        finalizedAt: new Date(),
        updatedAt: new Date(),
        version: existing.version + 1,
      })
      .where(eq(recurrences.id, recurrenceId))
      .returning();

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

    await this.app.db
      .update(recurrences)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
        version: existing.version + 1,
      })
      .where(eq(recurrences.id, recurrenceId));

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
    const transferCategoryId = await this.getTransferCategoryId();
    const todayByTimezone = new Map<string, string>();

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
      .orderBy(asc(recurrences.createdAt));

    let createdOccurrences = 0;
    let skippedOccurrences = 0;
    let createdTransactions = 0;
    let createdTransfers = 0;
    let finalizedRecurrences = 0;
    let failedRecurrences = 0;

    for (const recurrence of activeRecurrences) {
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

      if (this.compareIsoDate(cursorDate, recurrence.startDate) < 0) {
        cursorDate = recurrence.startDate;
      }

      let localCreated = 0;
      let localSkipped = 0;
      let localTransactions = 0;
      let localTransfers = 0;
      let localLastMaterializedDate: string | null = null;
      let shouldFinalize = false;
      let iterations = 0;

      try {
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

        while (this.compareIsoDate(cursorDate, untilDate) <= 0) {
          iterations += 1;
          if (iterations > this.maxMaterializationIterations) {
            throw new ValidationProblem(
              "Limite de materialização por recorrência excedido nesta execução.",
              "/recurrences/materialize",
            );
          }

          if (recurrence.endType === "until_date" && recurrence.endDate) {
            if (this.compareIsoDate(cursorDate, recurrence.endDate) > 0) {
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

            const transferResult = await this.materializeTransferOccurrence(
              tx,
              recurrence,
              cursorDate,
              transferCategoryId,
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

          cursorDate = this.calculateNextOccurrenceDate(recurrence, cursorDate);
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

        await this.app.db
          .insert(recurrenceOccurrences)
          .values({
            recurrenceId: recurrence.id,
            originType: recurrence.originType,
            occurrenceDate: cursorDate,
            status: "failed",
            metadata: { source: "recurrence-materialization", error: "materialization_failed" },
          })
          .onConflictDoNothing({
            target: [
              recurrenceOccurrences.recurrenceId,
              recurrenceOccurrences.occurrenceDate,
              recurrenceOccurrences.originType,
            ],
          });

        failedRecurrences += 1;
        continue;
      }

      const updatePayload: Partial<typeof recurrences.$inferInsert> = {
        nextOccurrenceDate: shouldFinalize ? null : cursorDate,
        updatedAt: new Date(),
        version: recurrence.version + 1,
      };

      if (localLastMaterializedDate) {
        updatePayload.lastMaterializedDate = localLastMaterializedDate;
        updatePayload.lastMaterializedAt = new Date();
      }

      if (shouldFinalize) {
        updatePayload.status = "finalized";
        updatePayload.finalizedAt = new Date();
        finalizedRecurrences += 1;
      }

      const [updatedRecurrence] = await this.app.db
        .update(recurrences)
        .set(updatePayload)
        .where(and(eq(recurrences.id, recurrence.id), eq(recurrences.version, recurrence.version)))
        .returning({ id: recurrences.id });

      if (!updatedRecurrence) {
        this.app.log.warn(
          { recurrenceId: recurrence.id, userId: recurrence.userId },
          "Skipping recurrence state update due to concurrent version change",
        );
      }

      createdOccurrences += localCreated;
      skippedOccurrences += localSkipped;
      createdTransactions += localTransactions;
      createdTransfers += localTransfers;
    }

    return {
      processedRecurrences: activeRecurrences.length,
      createdOccurrences,
      skippedOccurrences,
      createdTransactions,
      createdTransfers,
      finalizedRecurrences,
      failedRecurrences,
    };
  }
}
