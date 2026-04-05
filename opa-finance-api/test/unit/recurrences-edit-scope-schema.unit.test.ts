import { describe, expect, it } from "vitest";
import { editRecurrenceByScopeSchema } from "../../src/modules/recurrences/recurrence.schemas";

describe("recurrences edit scope schema", () => {
  it("aceita escopo all sem occurrenceDate", () => {
    const parsed = editRecurrenceByScopeSchema.parse({
      scope: "all",
      changes: {
        amount: 200,
      },
    });

    expect(parsed.scope).toBe("all");
    expect(parsed.occurrenceDate).toBeUndefined();
  });

  it("exige occurrenceDate para escopo single", () => {
    const result = editRecurrenceByScopeSchema.safeParse({
      scope: "single",
      changes: {
        amount: 150,
      },
    });

    expect(result.success).toBe(false);
  });

  it("exige occurrenceDate para escopo this_and_next", () => {
    const result = editRecurrenceByScopeSchema.safeParse({
      scope: "this_and_next",
      changes: {
        notes: "ajuste",
      },
    });

    expect(result.success).toBe(false);
  });

  it("valida formato/valor real de occurrenceDate", () => {
    const result = editRecurrenceByScopeSchema.safeParse({
      scope: "single",
      occurrenceDate: "2026-02-31",
      changes: {
        amount: 99,
      },
    });

    expect(result.success).toBe(false);
  });
});
