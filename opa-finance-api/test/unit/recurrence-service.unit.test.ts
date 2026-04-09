import { describe, expect, it, vi } from "vitest";
import { ValidationProblem } from "@/core/errors/problems";
import { RecurrenceService } from "@/modules/recurrences/recurrence.service";

function buildService() {
  const app = {
    db: {},
    log: {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    },
  } as any;

  return new RecurrenceService(app);
}

describe("recurrence service (unit)", () => {
  it("bloqueia recorrência de transação com campos de transferência inválidos", async () => {
    const service = buildService() as any;

    await expect(
      service.validateRecurrenceLinkedOwnership(
        "user-1",
        {
          originType: "transaction",
          accountId: "acc-1",
          categoryId: "cat-1",
          subcategoryId: null,
          fromAccountId: "from-acc",
          toAccountId: null,
        },
        "/recurrences/test",
      ),
    ).rejects.toBeInstanceOf(ValidationProblem);
  });

  it("bloqueia recorrência de transferência sem contas de origem/destino", async () => {
    const service = buildService() as any;

    await expect(
      service.validateRecurrenceLinkedOwnership(
        "user-1",
        {
          originType: "transfer",
          accountId: null,
          categoryId: null,
          subcategoryId: null,
          fromAccountId: null,
          toAccountId: null,
        },
        "/recurrences/test",
      ),
    ).rejects.toBeInstanceOf(ValidationProblem);
  });

  it("monta payload de criação para this_and_next preservando contrato da recorrência", () => {
    const service = buildService() as any;

    const payload = service.buildCreatePayloadFromRecurrence(
      {
        originType: "transaction",
        frequency: "monthly",
        startDate: "2099-01-10",
        dayOfWeek: null,
        dayOfMonth: 10,
        monthOfYear: null,
        endType: "never",
        endOccurrences: null,
        endDate: null,
        accountId: "acc-1",
        categoryId: "cat-1",
        subcategoryId: "sub-1",
        fromAccountId: null,
        toAccountId: null,
        amount: 100,
        description: "Base",
        notes: "Obs",
      },
      {
        amount: 200,
        categoryId: "cat-2",
      },
      "2099-02-10",
    );

    expect(payload.startDate).toBe("2099-02-10");
    expect(payload.amount).toBe(200);
    expect(payload.categoryId).toBe("cat-2");
    expect(payload.subcategoryId).toBeUndefined();
  });
});
