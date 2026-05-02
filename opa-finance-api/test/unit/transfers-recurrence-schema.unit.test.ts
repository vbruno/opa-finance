import { describe, expect, it } from "vitest";
import { createTransferSchema } from "../../src/modules/transfers/transfer.schemas";

const baseTransferPayload = {
  fromAccountId: "11111111-1111-4111-8111-111111111111",
  toAccountId: "22222222-2222-4222-8222-222222222222",
  amount: 200,
  date: "2026-04-10",
  description: "Reserva semanal",
};

describe("transfers recurrence schema", () => {
  it("aceita criação de transferência com recorrência quinzenal válida", () => {
    const parsed = createTransferSchema.parse({
      ...baseTransferPayload,
      recurrence: {
        frequency: "biweekly",
        dayOfWeek: 2,
        endType: "never",
      },
    });

    expect(parsed.recurrence?.frequency).toBe("biweekly");
    expect(parsed.recurrence?.postingMode).toBe("automatic");
  });

  it("aceita criação de transferência com recorrência em modo de revisão", () => {
    const parsed = createTransferSchema.parse({
      ...baseTransferPayload,
      recurrence: {
        postingMode: "review_required",
        frequency: "biweekly",
        dayOfWeek: 2,
        endType: "never",
      },
    });

    expect(parsed.recurrence?.postingMode).toBe("review_required");
  });

  it("exige dayOfWeek para recorrência quinzenal", () => {
    const result = createTransferSchema.safeParse({
      ...baseTransferPayload,
      recurrence: {
        frequency: "biweekly",
        endType: "never",
      },
    });

    expect(result.success).toBe(false);
  });

  it("bloqueia endDate anterior ao início efetivo da recorrência", () => {
    const result = createTransferSchema.safeParse({
      ...baseTransferPayload,
      recurrence: {
        frequency: "monthly",
        dayOfMonth: 10,
        startDate: "2026-04-10",
        endType: "until_date",
        endDate: "2026-04-01",
      },
    });

    expect(result.success).toBe(false);
  });
});
