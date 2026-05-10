import { describe, expect, it } from "vitest";
import {
  editRecurrenceByScopeSchema,
  updateRecurrenceSchema,
} from "../../src/modules/recurrences/recurrence.schemas";

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

  it("updateRecurrenceSchema rejeita originType definido com mensagem em pt-BR", () => {
    const result = updateRecurrenceSchema.safeParse({
      originType: "transaction",
      description: "x",
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ["originType"],
          message: "Não é permitido alterar o tipo de origem da recorrência.",
        }),
      ]),
    );
  });

  it("updateRecurrenceSchema rejeita originType com qualquer valor (transfer)", () => {
    const result = updateRecurrenceSchema.safeParse({
      originType: "transfer",
      description: "x",
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ["originType"],
          message: "Não é permitido alterar o tipo de origem da recorrência.",
        }),
      ]),
    );
  });

  it("updateRecurrenceSchema aceita payload sem originType", () => {
    const result = updateRecurrenceSchema.safeParse({
      description: "x",
    });

    expect(result.success).toBe(true);
  });

  it("updateRecurrenceSchema rejeita endDate anterior ao startDate com path endDate", () => {
    const result = updateRecurrenceSchema.safeParse({
      startDate: "2026-06-01",
      endDate: "2026-05-31",
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ["endDate"],
          message: "Data final não pode ser anterior à data de início.",
        }),
      ]),
    );
  });

  it("editRecurrenceByScopeSchema.changes propaga rejeição de originType", () => {
    const result = editRecurrenceByScopeSchema.safeParse({
      scope: "all",
      changes: {
        originType: "transaction",
      },
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ["changes", "originType"],
          message: "Não é permitido alterar o tipo de origem da recorrência.",
        }),
      ]),
    );
  });
});
