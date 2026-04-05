export const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export type RecurrenceFrequency = "weekly" | "biweekly" | "monthly" | "yearly";

export type RecurrenceSchedule = {
  startDate: string;
  frequency: RecurrenceFrequency;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  monthOfYear?: number | null;
};

export function isValidIsoDate(value: string) {
  if (!ISO_DATE_REGEX.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && formatIsoDate(date) === value;
}

export function formatIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function compareIsoDate(a: string, b: string) {
  return a.localeCompare(b);
}

function parseIsoDate(dateString: string) {
  if (!isValidIsoDate(dateString)) {
    throw new Error(`Invalid ISO date: ${dateString}`);
  }
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function getDaysInMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function addIsoDays(dateString: string, days: number) {
  const date = parseIsoDate(dateString);
  date.setUTCDate(date.getUTCDate() + days);
  return formatIsoDate(date);
}

export function addIsoDaysToDate(dateString: string, days: number) {
  return addIsoDays(dateString, days);
}

function addIsoMonths(dateString: string, months: number, preferredDay?: number) {
  const date = parseIsoDate(dateString);
  const sourceDay = preferredDay ?? date.getUTCDate();
  const sourceMonthIndex = date.getUTCMonth();
  const targetMonthIndex = sourceMonthIndex + months;
  const targetYear = date.getUTCFullYear() + Math.floor(targetMonthIndex / 12);
  const normalizedTargetMonthIndex = ((targetMonthIndex % 12) + 12) % 12;
  const maxDay = getDaysInMonth(targetYear, normalizedTargetMonthIndex);
  const day = Math.min(sourceDay, maxDay);
  return formatIsoDate(new Date(Date.UTC(targetYear, normalizedTargetMonthIndex, day)));
}

function addIsoYears(
  dateString: string,
  years: number,
  preferredMonth?: number,
  preferredDay?: number,
) {
  const date = parseIsoDate(dateString);
  const targetYear = date.getUTCFullYear() + years;
  const month = (preferredMonth ?? date.getUTCMonth() + 1) - 1;
  const sourceDay = preferredDay ?? date.getUTCDate();
  const maxDay = getDaysInMonth(targetYear, month);
  const day = Math.min(sourceDay, maxDay);
  return formatIsoDate(new Date(Date.UTC(targetYear, month, day)));
}

function diffIsoDays(fromDate: string, toDate: string) {
  const from = parseIsoDate(fromDate).getTime();
  const to = parseIsoDate(toDate).getTime();
  return Math.floor((to - from) / (24 * 60 * 60 * 1000));
}

export function getFirstOccurrenceOnOrAfter(schedule: RecurrenceSchedule, anchorDate: string) {
  const anchor =
    compareIsoDate(anchorDate, schedule.startDate) < 0 ? schedule.startDate : anchorDate;

  if (schedule.frequency === "weekly" || schedule.frequency === "biweekly") {
    const dayOfWeek = schedule.dayOfWeek ?? parseIsoDate(schedule.startDate).getUTCDay();
    const startDow = parseIsoDate(schedule.startDate).getUTCDay();
    const delta = (dayOfWeek - startDow + 7) % 7;
    const seriesStart = addIsoDays(schedule.startDate, delta);
    if (compareIsoDate(anchor, seriesStart) <= 0) return seriesStart;
    const intervalDays = schedule.frequency === "weekly" ? 7 : 14;
    const steps = Math.ceil(diffIsoDays(seriesStart, anchor) / intervalDays);
    return addIsoDays(seriesStart, steps * intervalDays);
  }

  if (schedule.frequency === "monthly") {
    const day = schedule.dayOfMonth ?? parseIsoDate(schedule.startDate).getUTCDate();
    let candidate = addIsoMonths(
      formatIsoDate(
        new Date(
          Date.UTC(
            parseIsoDate(schedule.startDate).getUTCFullYear(),
            parseIsoDate(schedule.startDate).getUTCMonth(),
            1,
          ),
        ),
      ),
      0,
      day,
    );
    if (compareIsoDate(candidate, schedule.startDate) < 0) {
      candidate = addIsoMonths(candidate, 1, day);
    }
    while (compareIsoDate(candidate, anchor) < 0) {
      candidate = addIsoMonths(candidate, 1, day);
    }
    return candidate;
  }

  const start = parseIsoDate(schedule.startDate);
  const month = schedule.monthOfYear ?? start.getUTCMonth() + 1;
  const day = schedule.dayOfMonth ?? start.getUTCDate();
  let candidate = addIsoYears(
    formatIsoDate(new Date(Date.UTC(start.getUTCFullYear(), month - 1, Math.min(day, 28)))),
    0,
    month,
    day,
  );
  if (compareIsoDate(candidate, schedule.startDate) < 0) {
    candidate = addIsoYears(candidate, 1, month, day);
  }
  while (compareIsoDate(candidate, anchor) < 0) {
    candidate = addIsoYears(candidate, 1, month, day);
  }
  return candidate;
}

export function getFirstOccurrence(schedule: RecurrenceSchedule) {
  return getFirstOccurrenceOnOrAfter(schedule, schedule.startDate);
}

export function getNextOccurrenceAfter(schedule: RecurrenceSchedule, currentDate: string) {
  return getFirstOccurrenceOnOrAfter(schedule, addIsoDays(currentDate, 1));
}

export function resolveSubmitOccurrence(schedule: RecurrenceSchedule, submitDate: string) {
  const occurrenceOnOrAfterSubmitDate = getFirstOccurrenceOnOrAfter(schedule, submitDate);
  const materializedOnSubmit = occurrenceOnOrAfterSubmitDate === submitDate;
  const nextOccurrenceDate = materializedOnSubmit
    ? getNextOccurrenceAfter(schedule, submitDate)
    : occurrenceOnOrAfterSubmitDate;

  return {
    materializedOnSubmit,
    nextOccurrenceDate,
    occurrenceOnOrAfterSubmitDate,
  };
}
