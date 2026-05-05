import { describe, expect, it } from "vitest";
import { ValidationProblem } from "@/core/errors/problems";
import { buildCreatePayloadFromRecurrence } from "@/modules/recurrences/recurrence.helpers";
import { RecurrenceValidators } from "@/modules/recurrences/recurrence.validators";

function buildValidators() {
  return new RecurrenceValidators({} as ConstructorParameters<typeof RecurrenceValidators>[0]);
}

describe("recurrence service (unit)", () => {
  it("bloqueia recorrência de transação com campos de transferência inválidos", async () => {
    const validators = buildValidators();

    await expect(
      validators.validateRecurrenceLinkedOwnership(
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
    const validators = buildValidators();

    await expect(
      validators.validateRecurrenceLinkedOwnership(
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
    const payload = buildCreatePayloadFromRecurrence(
      {
        originType: "transaction",
        postingMode: "review_required",
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
    expect(payload.postingMode).toBe("review_required");
    expect(payload.amount).toBe(200);
    expect(payload.categoryId).toBe("cat-2");
    expect(payload.subcategoryId).toBeUndefined();
  });

  it("normaliza término ao criar nova regra this_and_next com data final", () => {
    const payload = buildCreatePayloadFromRecurrence(
      {
        originType: "transaction",
        postingMode: "automatic",
        frequency: "monthly",
        startDate: "2099-01-10",
        dayOfWeek: null,
        dayOfMonth: 10,
        monthOfYear: null,
        endType: "by_occurrences",
        endOccurrences: 5,
        endDate: null,
        accountId: "acc-1",
        categoryId: "cat-1",
        subcategoryId: null,
        fromAccountId: null,
        toAccountId: null,
        amount: 100,
        description: "Base",
        notes: null,
      },
      {
        endType: "until_date",
        endDate: "2099-12-31",
      },
      "2099-02-10",
    );

    expect(payload.endType).toBe("until_date");
    expect(payload.endDate).toBe("2099-12-31");
    expect(payload.endOccurrences).toBeUndefined();
  });
});
