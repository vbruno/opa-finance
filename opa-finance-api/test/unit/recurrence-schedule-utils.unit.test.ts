import { describe, expect, it } from "vitest";
import {
  getFirstOccurrenceOnOrAfter,
  getNextOccurrenceAfter,
  type RecurrenceSchedule,
  resolveSubmitOccurrence,
} from "../../src/core/utils/recurrence-schedule.utils";

describe("recurrence schedule utils", () => {
  it("materializa no submit quando a data enviada é uma ocorrência válida", () => {
    const schedule: RecurrenceSchedule = {
      startDate: "2026-01-10",
      frequency: "monthly",
      dayOfMonth: 10,
    };

    const result = resolveSubmitOccurrence(schedule, "2026-03-10");

    expect(result.materializedOnSubmit).toBe(true);
    expect(result.nextOccurrenceDate).toBe("2026-04-10");
  });

  it("não materializa no submit quando a data enviada não é ocorrência da série", () => {
    const schedule: RecurrenceSchedule = {
      startDate: "2026-01-10",
      frequency: "monthly",
      dayOfMonth: 10,
    };

    const result = resolveSubmitOccurrence(schedule, "2026-03-09");

    expect(result.materializedOnSubmit).toBe(false);
    expect(result.nextOccurrenceDate).toBe("2026-03-10");
  });

  it("alinha mensal para último dia válido quando o dia não existe no mês", () => {
    const schedule: RecurrenceSchedule = {
      startDate: "2026-01-31",
      frequency: "monthly",
      dayOfMonth: 31,
    };

    expect(getFirstOccurrenceOnOrAfter(schedule, "2026-02-01")).toBe("2026-02-28");
    expect(getNextOccurrenceAfter(schedule, "2026-02-28")).toBe("2026-03-31");
  });

  it("mantém regra anual em ano não bissexto para 28/02 quando origem é 29/02", () => {
    const schedule: RecurrenceSchedule = {
      startDate: "2024-02-29",
      frequency: "yearly",
      monthOfYear: 2,
      dayOfMonth: 29,
    };

    expect(getFirstOccurrenceOnOrAfter(schedule, "2025-01-01")).toBe("2025-02-28");
    expect(getNextOccurrenceAfter(schedule, "2025-02-28")).toBe("2026-02-28");
  });
});
