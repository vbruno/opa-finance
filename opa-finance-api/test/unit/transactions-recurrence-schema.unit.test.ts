import { describe, expect, it } from "vitest";
import { createTransactionSchema } from "../../src/modules/transactions/transaction.schemas";

const baseTransactionPayload = {
  accountId: "11111111-1111-4111-8111-111111111111",
  categoryId: "22222222-2222-4222-8222-222222222222",
  type: "expense" as const,
  amount: 100,
  date: "2026-04-10",
  description: "Plano de celular",
};

describe("transactions recurrence schema", () => {
  it("aceita criação de transação com recorrência mensal válida", () => {
    const parsed = createTransactionSchema.parse({
      ...baseTransactionPayload,
      recurrence: {
        frequency: "monthly",
        dayOfMonth: 10,
        endType: "never",
      },
    });

    expect(parsed.recurrence?.frequency).toBe("monthly");
    expect(parsed.recurrence?.postingMode).toBe("automatic");
  });

  it("aceita criação de transação com recorrência em modo de revisão", () => {
    const parsed = createTransactionSchema.parse({
      ...baseTransactionPayload,
      recurrence: {
        postingMode: "review_required",
        frequency: "monthly",
        dayOfMonth: 10,
        endType: "never",
      },
    });

    expect(parsed.recurrence?.postingMode).toBe("review_required");
  });

  it("exige dayOfWeek para recorrência semanal", () => {
    const result = createTransactionSchema.safeParse({
      ...baseTransactionPayload,
      recurrence: {
        frequency: "weekly",
        endType: "never",
      },
    });

    expect(result.success).toBe(false);
  });

  it("bloqueia endDate anterior ao início efetivo da recorrência", () => {
    const result = createTransactionSchema.safeParse({
      ...baseTransactionPayload,
      recurrence: {
        frequency: "monthly",
        dayOfMonth: 10,
        startDate: "2026-04-10",
        endType: "until_date",
        endDate: "2026-04-09",
      },
    });

    expect(result.success).toBe(false);
  });
});
