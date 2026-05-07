import {
  compareIsoDate,
  getFirstOccurrence,
  getNextOccurrenceAfter,
  type RecurrenceSchedule,
} from "../../core/utils/recurrence-schedule.utils";
import type { recurrences } from "../../db/schema";
import type { CreateRecurrenceInput, UpdateRecurrenceInput } from "./recurrence.schemas";

type SerializedRecurrence = ReturnType<typeof serializeRecurrence>;

export const STRUCTURAL_LOCK_CONSUMED_OCCURRENCE_STATUSES = [
  "materialized",
  "pending_review",
  "skipped",
  "failed",
] as const;

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addOneYearIsoDate(dateString: string): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const maxDay = new Date(Date.UTC(year + 1, month, 0)).getUTCDate();
  return toIsoDate(new Date(Date.UTC(year + 1, month - 1, Math.min(day, maxDay))));
}

export function minIsoDate(...dates: Array<string | null | undefined>): string | null {
  return dates.filter((date): date is string => Boolean(date)).sort(compareIsoDate)[0] ?? null;
}

export function resolveOperationalEndDate(recurrence: {
  startDate: string;
  endType: "never" | "by_occurrences" | "until_date";
  endDate?: string | null;
}): string | null {
  if (recurrence.endType === "never") {
    return addOneYearIsoDate(recurrence.startDate);
  }

  if (recurrence.endType === "until_date") {
    return recurrence.endDate ?? null;
  }

  return null;
}

export function getFirstOccurrenceForRecurrence(schedule: RecurrenceSchedule): string {
  return getFirstOccurrence(schedule);
}

export function getNextOccurrenceAfterDate(schedule: RecurrenceSchedule, date: string): string {
  return getNextOccurrenceAfter(schedule, date);
}

export function mergeLastMaterializedDate(
  baseDate: string | null | undefined,
  candidateDate: string | null | undefined,
): string | null {
  if (!baseDate) return candidateDate ?? null;
  if (!candidateDate) return baseDate;
  return compareIsoDate(candidateDate, baseDate) > 0 ? candidateDate : baseDate;
}

export function serializeRecurrence(row: typeof recurrences.$inferSelect) {
  return {
    ...row,
    amount: Number(row.amount),
  };
}

export function buildCreatePayloadFromRecurrence(
  recurrence: SerializedRecurrence,
  changes: UpdateRecurrenceInput,
  startDate: string,
): CreateRecurrenceInput {
  const endType = changes.endType ?? recurrence.endType;
  const endOccurrences =
    endType === "by_occurrences"
      ? (changes.endOccurrences ?? recurrence.endOccurrences ?? undefined)
      : undefined;
  const endDate =
    endType === "until_date" ? (changes.endDate ?? recurrence.endDate ?? undefined) : undefined;
  const nextSubcategoryId =
    changes.categoryId !== undefined && changes.subcategoryId === undefined
      ? undefined
      : (changes.subcategoryId ?? recurrence.subcategoryId ?? undefined);

  return {
    originType: recurrence.originType,
    postingMode: changes.postingMode ?? recurrence.postingMode,
    frequency: changes.frequency ?? recurrence.frequency,
    startDate,
    dayOfWeek: changes.dayOfWeek ?? recurrence.dayOfWeek ?? undefined,
    dayOfMonth: changes.dayOfMonth ?? recurrence.dayOfMonth ?? undefined,
    monthOfYear: changes.monthOfYear ?? recurrence.monthOfYear ?? undefined,
    endType,
    endOccurrences,
    endDate,
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

export function emptyMonths(): number[] {
  return Array.from({ length: 12 }, () => 0);
}

export function sumYear(months: number[]): number {
  return months.reduce((acc, value) => acc + value, 0);
}
