import { describe, expect, it } from "vitest";
import {
  createRecurrenceSchema,
  materializeRecurrencesSchema,
  updateRecurrenceSchema,
} from "../../src/modules/recurrences/recurrence.schemas";

const baseTransactionRecurrence = {
  originType: "transaction" as const,
  frequency: "monthly" as const,
  startDate: "2026-04-10",
  dayOfMonth: 10,
  endType: "never" as const,
  accountId: "11111111-1111-4111-8111-111111111111",
  categoryId: "22222222-2222-4222-8222-222222222222",
  amount: 100,
};

describe("recurrences create and update schema", () => {
  it("aceita create de recorrência de transação válida", () => {
    const parsed = createRecurrenceSchema.parse(baseTransactionRecurrence);
    expect(parsed.originType).toBe("transaction");
    expect(parsed.frequency).toBe("monthly");
    expect(parsed.postingMode).toBe("automatic");
  });

  it("aceita create de recorrência com revisão antes de lançar", () => {
    const parsed = createRecurrenceSchema.parse({
      ...baseTransactionRecurrence,
      postingMode: "review_required",
    });

    expect(parsed.postingMode).toBe("review_required");
  });

  it("bloqueia postingMode inválido", () => {
    const result = createRecurrenceSchema.safeParse({
      ...baseTransactionRecurrence,
      postingMode: "manual_review",
    });

    expect(result.success).toBe(false);
  });

  it("bloqueia create de transferência com mesma conta origem/destino", () => {
    const result = createRecurrenceSchema.safeParse({
      originType: "transfer",
      frequency: "weekly",
      startDate: "2026-04-10",
      dayOfWeek: 1,
      fromAccountId: "33333333-3333-4333-8333-333333333333",
      toAccountId: "33333333-3333-4333-8333-333333333333",
      amount: 200,
    });

    expect(result.success).toBe(false);
  });

  it("aceita update parcial sem aplicar defaults da criação", () => {
    const result = updateRecurrenceSchema.safeParse({
      description: "Descrição alterada",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.endType).toBeUndefined();
    expect(result.data.postingMode).toBeUndefined();
  });

  it("bloqueia update vazio", () => {
    const result = updateRecurrenceSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it("bloqueia update apenas com expectedVersion", () => {
    const result = updateRecurrenceSchema.safeParse({
      expectedVersion: 1,
    });

    expect(result.success).toBe(false);
  });

  it("aceita limpar subcategoria no update", () => {
    const result = updateRecurrenceSchema.safeParse({
      subcategoryId: null,
    });

    expect(result.success).toBe(true);
  });

  it("bloqueia mudança de frequência sem campos de agenda obrigatórios", () => {
    const result = updateRecurrenceSchema.safeParse({
      frequency: "weekly",
    });

    expect(result.success).toBe(false);
  });
});

describe("recurrences materialize schema", () => {
  it("aceita maxRecurrences no limite válido", () => {
    const parsed = materializeRecurrencesSchema.parse({
      untilDate: "2026-12-31",
      maxRecurrences: 500,
    });

    expect(parsed.maxRecurrences).toBe(500);
  });

  it("bloqueia maxRecurrences acima do limite", () => {
    const result = materializeRecurrencesSchema.safeParse({
      maxRecurrences: 501,
    });

    expect(result.success).toBe(false);
  });

  it("bloqueia untilDate inválida", () => {
    const result = materializeRecurrencesSchema.safeParse({
      untilDate: "2026-02-30",
    });

    expect(result.success).toBe(false);
  });
});
