import { and, asc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { NotFoundProblem } from "../../core/errors/problems";
import {
  compareIsoDate,
  getFirstOccurrenceOnOrAfter,
  getNextOccurrenceAfter,
  type RecurrenceSchedule,
} from "../../core/utils/recurrence-schedule.utils";
import { DEFAULT_TIMEZONE } from "../../core/utils/timezone.utils";
import {
  categories,
  recurrenceOccurrenceOverrides,
  recurrenceOccurrences,
  recurrences,
  transactions,
  users,
} from "../../db/schema";
import { CONSUMED_OCCURRENCE_STATUSES, emptyMonths, sumYear } from "./recurrence.helpers";
import type { RecurrencesForecastQuery } from "./recurrence.schemas";
import { recurrenceOccurrenceReviewPayloadSchema } from "./recurrence.schemas";
import { RecurrenceValidators } from "./recurrence.validators";

export class RecurrenceForecastService {
  private readonly maxMaterializationIterations = 500;

  constructor(
    private app: FastifyInstance,
    private validators: RecurrenceValidators,
  ) {}

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
    await this.validators.ensureUserOwnsAllAccounts(userId, accountIds, "/recurrences/forecast");
    const accountSet = new Set(accountIds);

    const today = await this.validators.getNowIsoDateInTimezone(user.timezone ?? DEFAULT_TIMEZONE);
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
      income: { months: emptyMonths(), yearTotal: 0 },
      expense: { months: emptyMonths(), yearTotal: 0 },
    };
    const projected = {
      income: { months: emptyMonths(), yearTotal: 0 },
      expense: { months: emptyMonths(), yearTotal: 0 },
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
      const consumedCountByRecurrence = new Map<string, number>();
      const consumedDateSet = new Set<string>();
      const pendingReviewRows: Array<{
        recurrenceId: string;
        occurrenceDate: string;
        reviewPayload: unknown;
      }> = [];

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
              inArray(recurrenceOccurrences.status, CONSUMED_OCCURRENCE_STATUSES),
            ),
          )
          .groupBy(recurrenceOccurrences.recurrenceId);

        for (const item of counts) {
          consumedCountByRecurrence.set(item.recurrenceId, item.total ?? 0);
        }

        const consumedRows = await this.app.db
          .select({
            recurrenceId: recurrenceOccurrences.recurrenceId,
            occurrenceDate: recurrenceOccurrences.occurrenceDate,
            status: recurrenceOccurrences.status,
            reviewPayload: recurrenceOccurrences.reviewPayload,
          })
          .from(recurrenceOccurrences)
          .where(
            and(
              inArray(recurrenceOccurrences.recurrenceId, recurrenceIds),
              inArray(recurrenceOccurrences.status, CONSUMED_OCCURRENCE_STATUSES),
              gte(recurrenceOccurrences.occurrenceDate, projectionStartDate),
              lte(recurrenceOccurrences.occurrenceDate, yearEndDate),
            ),
          );

        for (const row of consumedRows) {
          consumedDateSet.add(`${row.recurrenceId}:${row.occurrenceDate}`);
          if (row.status === "pending_review") {
            pendingReviewRows.push({
              recurrenceId: row.recurrenceId,
              occurrenceDate: row.occurrenceDate,
              reviewPayload: row.reviewPayload,
            });
          }
        }
      }

      const overrideRows: Array<{
        recurrenceId: string;
        occurrenceDate: string;
        amount: string | null;
      }> =
        recurrenceIds.length > 0
          ? await this.app.db
              .select({
                recurrenceId: recurrenceOccurrenceOverrides.recurrenceId,
                occurrenceDate: recurrenceOccurrenceOverrides.occurrenceDate,
                amount: recurrenceOccurrenceOverrides.amount,
              })
              .from(recurrenceOccurrenceOverrides)
              .where(
                and(
                  inArray(recurrenceOccurrenceOverrides.recurrenceId, recurrenceIds),
                  gte(recurrenceOccurrenceOverrides.occurrenceDate, projectionStartDate),
                  lte(recurrenceOccurrenceOverrides.occurrenceDate, yearEndDate),
                ),
              )
          : [];

      const overrideAmountByKey = new Map<string, string | null>(
        overrideRows.map((row) => [`${row.recurrenceId}:${row.occurrenceDate}`, row.amount]),
      );

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

      const recurrenceById = new Map(activeRecurrences.map((row) => [row.id, row]));

      for (const pendingRow of pendingReviewRows) {
        const recurrence = recurrenceById.get(pendingRow.recurrenceId);
        if (!recurrence) continue;

        const parsed = recurrenceOccurrenceReviewPayloadSchema.safeParse(pendingRow.reviewPayload);
        const amount = parsed.success ? parsed.data.amount : Number(recurrence.amount);
        if (!Number.isFinite(amount)) continue;

        const monthIndex = Math.max(
          0,
          Math.min(11, Number(pendingRow.occurrenceDate.slice(5, 7)) - 1),
        );
        let counted = false;

        if (recurrence.originType === "transaction") {
          if (!recurrence.accountId || !recurrence.categoryId) continue;
          const includeByAccount = accountSet.size === 0 || accountSet.has(recurrence.accountId);
          if (!includeByAccount) continue;
          const transactionType = categoryTypeById.get(recurrence.categoryId);
          if (!transactionType) continue;
          projected[transactionType].months[monthIndex] += amount;
          counted = true;
        } else if (recurrence.fromAccountId && recurrence.toAccountId) {
          const includeExpense = accountSet.size === 0 || accountSet.has(recurrence.fromAccountId);
          const includeIncome = accountSet.size === 0 || accountSet.has(recurrence.toAccountId);
          if (includeExpense) {
            projected.expense.months[monthIndex] += amount;
            counted = true;
          }
          if (includeIncome) {
            projected.income.months[monthIndex] += amount;
            counted = true;
          }
        }

        if (counted) projectedOccurrences += 1;
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
          const consumedCount = consumedCountByRecurrence.get(recurrence.id) ?? 0;
          remainingOccurrences = recurrence.endOccurrences - consumedCount;
          if (remainingOccurrences <= 0) continue;
        }

        let iterations = 0;
        while (compareIsoDate(cursorDate, yearEndDate) <= 0) {
          iterations += 1;
          if (iterations > this.maxMaterializationIterations) break;

          if (recurrence.endType === "until_date" && recurrence.endDate) {
            if (compareIsoDate(cursorDate, recurrence.endDate) > 0) break;
          }

          if (remainingOccurrences <= 0) break;

          const occurrenceKey = `${recurrence.id}:${cursorDate}`;
          if (!consumedDateSet.has(occurrenceKey)) {
            const monthIndex = Math.max(0, Math.min(11, Number(cursorDate.slice(5, 7)) - 1));
            const overrideAmount = overrideAmountByKey.get(occurrenceKey);
            const baseAmount = overrideAmount ?? recurrence.amount;
            const amount = Number(baseAmount);
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

            if (counted) projectedOccurrences += 1;
          }

          try {
            cursorDate = getNextOccurrenceAfter(schedule, cursorDate);
          } catch {
            break;
          }
        }
      }
    }

    real.income.yearTotal = Number(sumYear(real.income.months));
    real.expense.yearTotal = Number(sumYear(real.expense.months));
    projected.income.yearTotal = Number(sumYear(projected.income.months));
    projected.expense.yearTotal = Number(sumYear(projected.expense.months));

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
          income: { months: real.income.months, yearTotal: real.income.yearTotal },
          expense: { months: real.expense.months, yearTotal: real.expense.yearTotal },
          balance: { months: realBalanceMonths, yearTotal: Number(sumYear(realBalanceMonths)) },
        },
        projected: {
          income: { months: projected.income.months, yearTotal: projected.income.yearTotal },
          expense: { months: projected.expense.months, yearTotal: projected.expense.yearTotal },
          balance: {
            months: projectedBalanceMonths,
            yearTotal: Number(sumYear(projectedBalanceMonths)),
          },
        },
        combined: {
          income: {
            months: combinedIncomeMonths,
            yearTotal: Number(sumYear(combinedIncomeMonths)),
          },
          expense: {
            months: combinedExpenseMonths,
            yearTotal: Number(sumYear(combinedExpenseMonths)),
          },
          balance: {
            months: combinedBalanceMonths,
            yearTotal: Number(sumYear(combinedBalanceMonths)),
          },
        },
      },
      metadata: { projectedOccurrences },
    };
  }
}
