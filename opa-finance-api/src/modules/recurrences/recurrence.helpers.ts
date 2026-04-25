import {
  compareIsoDate,
  getFirstOccurrence,
  getNextOccurrenceAfter,
  type RecurrenceSchedule,
} from "../../core/utils/recurrence-schedule.utils";
import type { recurrences } from "../../db/schema";
import type { CreateRecurrenceInput, UpdateRecurrenceInput } from "./recurrence.schemas";

type SerializedRecurrence = ReturnType<typeof serializeRecurrence>;

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
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

export function emptyMonths(): number[] {
  return Array.from({ length: 12 }, () => 0);
}

export function sumYear(months: number[]): number {
  return months.reduce((acc, value) => acc + value, 0);
}
