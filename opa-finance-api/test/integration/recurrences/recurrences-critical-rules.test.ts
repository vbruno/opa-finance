import { and, asc, eq, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { registerAndLogin } from "../helpers/auth";
import { resetTables } from "../helpers/resetTables";
import { buildTestApp } from "../setup";
import {
  categories,
  recurrenceOccurrenceOverrides,
  recurrenceOccurrences,
  recurrences,
  transactions,
} from "@/db/schema";

describe("Recurrences - critical rules", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    const built = await buildTestApp();
    app = built.app;
    await resetTables(built.db);
  });

  afterEach(async () => {
    await app?.close();
  });

  async function createBaseContext() {
    const email = `user_${crypto.randomUUID()}@test.com`;
    const { token, user } = await registerAndLogin(app, app.db, email);

    const accountRes = await app.inject({
      method: "POST",
      url: "/accounts",
      headers: { Authorization: `Bearer ${token}` },
      payload: { name: "Conta Base", type: "cash" },
    });
    expect(accountRes.statusCode).toBe(201);
    const account = accountRes.json();

    const account2Res = await app.inject({
      method: "POST",
      url: "/accounts",
      headers: { Authorization: `Bearer ${token}` },
      payload: { name: "Conta Secundaria", type: "cash" },
    });
    expect(account2Res.statusCode).toBe(201);
    const account2 = account2Res.json();

    const categoryRes = await app.inject({
      method: "POST",
      url: "/categories",
      headers: { Authorization: `Bearer ${token}` },
      payload: { name: "Moradia", type: "expense" },
    });
    expect(categoryRes.statusCode).toBe(201);
    const category = categoryRes.json();

    const category2Res = await app.inject({
      method: "POST",
      url: "/categories",
      headers: { Authorization: `Bearer ${token}` },
      payload: { name: "Transporte", type: "expense" },
    });
    expect(category2Res.statusCode).toBe(201);
    const category2 = category2Res.json();

    const subcategoryRes = await app.inject({
      method: "POST",
      url: "/subcategories",
      headers: { Authorization: `Bearer ${token}` },
      payload: { name: "Aluguel", categoryId: category.id },
    });
    expect(subcategoryRes.statusCode).toBe(201);
    const subcategory = subcategoryRes.json();

    return { token, user, account, account2, category, category2, subcategory };
  }

  async function createTransactionRecurrence({
    token,
    accountId,
    categoryId,
    amount = 120,
    startDate = "2025-01-06",
    frequency = "weekly",
    dayOfWeek = 1,
    dayOfMonth,
    postingMode = "automatic",
    endType = "never",
    endOccurrences,
    endDate,
  }: {
    token: string;
    accountId: string;
    categoryId: string;
    amount?: number;
    startDate?: string;
    frequency?: "weekly" | "biweekly" | "monthly" | "yearly";
    dayOfWeek?: number;
    dayOfMonth?: number;
    postingMode?: "automatic" | "review_required";
    endType?: "never" | "by_occurrences" | "until_date";
    endOccurrences?: number;
    endDate?: string;
  }) {
    const res = await app.inject({
      method: "POST",
      url: "/recurrences",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        originType: "transaction",
        postingMode,
        frequency,
        startDate,
        dayOfWeek: frequency === "weekly" || frequency === "biweekly" ? dayOfWeek : undefined,
        dayOfMonth: frequency === "monthly" || frequency === "yearly" ? dayOfMonth : undefined,
        endType,
        endOccurrences,
        endDate,
        accountId,
        categoryId,
        amount,
        description: "Despesa recorrente",
      },
    });

    expect(res.statusCode).toBe(201);
    return res.json();
  }

  async function insertOccurrenceForRecurrence({
    recurrenceId,
    originType = "transaction",
    occurrenceDate,
    status,
  }: {
    recurrenceId: string;
    originType?: "transaction" | "transfer";
    occurrenceDate: string;
    status: typeof recurrenceOccurrences.$inferInsert.status;
  }) {
    const [occurrence] = await app.db
      .insert(recurrenceOccurrences)
      .values({
        recurrenceId,
        originType,
        occurrenceDate,
        status,
      })
      .returning();

    return occurrence;
  }

  it("garante idempotencia na materializacao", async () => {
    const { token, account, category } = await createBaseContext();
    await createTransactionRecurrence({
      token,
      accountId: account.id,
      categoryId: category.id,
      startDate: "2025-01-06",
      dayOfWeek: 1,
    });

    const firstRun = await app.inject({
      method: "POST",
      url: "/recurrences/materialize",
      headers: { Authorization: `Bearer ${token}` },
      payload: { untilDate: "2025-01-20" },
    });

    expect(firstRun.statusCode).toBe(200);
    expect(firstRun.json().createdOccurrences).toBe(3);
    expect(firstRun.json().skippedOccurrences).toBe(0);
    expect(firstRun.json().createdTransactions).toBe(3);

    const secondRun = await app.inject({
      method: "POST",
      url: "/recurrences/materialize",
      headers: { Authorization: `Bearer ${token}` },
      payload: { untilDate: "2025-01-20" },
    });

    expect(secondRun.statusCode).toBe(200);
    expect(secondRun.json().createdOccurrences).toBe(0);
    expect(secondRun.json().skippedOccurrences).toBe(0);
    expect(secondRun.json().createdTransactions).toBe(0);
  });

  it("nao duplica pendencias review_required ao rodar o job duas vezes na mesma janela", async () => {
    const { token, account, category } = await createBaseContext();
    const recurrence = await createTransactionRecurrence({
      token,
      accountId: account.id,
      categoryId: category.id,
      postingMode: "review_required",
      startDate: "2025-01-06",
      dayOfWeek: 1,
      endType: "by_occurrences",
      endOccurrences: 2,
    });

    const firstRun = await app.inject({
      method: "POST",
      url: "/recurrences/materialize",
      headers: { Authorization: `Bearer ${token}` },
      payload: { untilDate: "2025-01-13" },
    });

    expect(firstRun.statusCode).toBe(200);
    expect(firstRun.json()).toMatchObject({
      createdOccurrences: 2,
      createdTransactions: 0,
      skippedOccurrences: 0,
    });

    const secondRun = await app.inject({
      method: "POST",
      url: "/recurrences/materialize",
      headers: { Authorization: `Bearer ${token}` },
      payload: { untilDate: "2025-01-13" },
    });

    expect(secondRun.statusCode).toBe(200);
    expect(secondRun.json()).toMatchObject({
      createdOccurrences: 0,
      createdTransactions: 0,
      skippedOccurrences: 0,
    });

    const occurrences = await app.db
      .select({
        status: recurrenceOccurrences.status,
        occurrenceDate: recurrenceOccurrences.occurrenceDate,
        transactionId: recurrenceOccurrences.transactionId,
      })
      .from(recurrenceOccurrences)
      .where(eq(recurrenceOccurrences.recurrenceId, recurrence.id))
      .orderBy(asc(recurrenceOccurrences.occurrenceDate));

    expect(occurrences).toHaveLength(2);
    expect(occurrences.every((occurrence) => occurrence.status === "pending_review")).toBe(true);
    expect(occurrences.every((occurrence) => occurrence.transactionId === null)).toBe(true);

    const [updatedRecurrence] = await app.db
      .select({
        nextOccurrenceDate: recurrences.nextOccurrenceDate,
        lastMaterializedDate: recurrences.lastMaterializedDate,
      })
      .from(recurrences)
      .where(eq(recurrences.id, recurrence.id));

    expect(updatedRecurrence?.nextOccurrenceDate).toBe("2025-01-20");
    expect(updatedRecurrence?.lastMaterializedDate).toBeNull();
  });

  it("avanca nextOccurrenceDate em review_required sem alterar lastMaterializedDate", async () => {
    const { token, account, category } = await createBaseContext();
    const recurrence = await createTransactionRecurrence({
      token,
      accountId: account.id,
      categoryId: category.id,
      postingMode: "review_required",
      startDate: "2025-01-06",
      dayOfWeek: 1,
      endType: "by_occurrences",
      endOccurrences: 3,
    });

    const materializeRes = await app.inject({
      method: "POST",
      url: "/recurrences/materialize",
      headers: { Authorization: `Bearer ${token}` },
      payload: { untilDate: "2025-01-06" },
    });

    expect(materializeRes.statusCode).toBe(200);
    expect(materializeRes.json()).toMatchObject({
      createdOccurrences: 1,
      createdTransactions: 0,
      skippedOccurrences: 0,
      finalizedRecurrences: 0,
    });

    const [updatedRecurrence] = await app.db
      .select({
        nextOccurrenceDate: recurrences.nextOccurrenceDate,
        lastMaterializedDate: recurrences.lastMaterializedDate,
      })
      .from(recurrences)
      .where(eq(recurrences.id, recurrence.id));

    expect(updatedRecurrence?.nextOccurrenceDate).toBe("2025-01-13");
    expect(updatedRecurrence?.lastMaterializedDate).toBeNull();
  });

  it("nao retorna pendencias review_required em GET /transactions", async () => {
    const { token, account, category } = await createBaseContext();
    await createTransactionRecurrence({
      token,
      accountId: account.id,
      categoryId: category.id,
      postingMode: "review_required",
      startDate: "2025-01-06",
      dayOfWeek: 1,
    });

    const materializeRes = await app.inject({
      method: "POST",
      url: "/recurrences/materialize",
      headers: { Authorization: `Bearer ${token}` },
      payload: { untilDate: "2025-01-06" },
    });

    expect(materializeRes.statusCode).toBe(200);

    const manualTransactionRes = await app.inject({
      method: "POST",
      url: "/transactions",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        accountId: account.id,
        categoryId: category.id,
        type: "expense",
        amount: 75,
        date: "2025-01-07",
        description: "Compra manual",
      },
    });
    expect(manualTransactionRes.statusCode).toBe(201);

    const transactionsRes = await app.inject({
      method: "GET",
      url: "/transactions",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(transactionsRes.statusCode).toBe(200);
    const transactionsList = transactionsRes.json();
    expect(transactionsList.data).toHaveLength(1);
    expect(transactionsList.data[0].description).toBe("Compra manual");
    expect(
      transactionsList.data.every((transaction: { description: string }) => {
        return transaction.description !== "Despesa recorrente";
      }),
    ).toBe(true);
  });

  it("materializa recorrência automatic sem regressão", async () => {
    const { token, account, category } = await createBaseContext();
    const recurrence = await createTransactionRecurrence({
      token,
      accountId: account.id,
      categoryId: category.id,
      postingMode: "automatic",
      startDate: "2099-01-05",
      dayOfWeek: 1,
      endType: "by_occurrences",
      endOccurrences: 2,
    });

    const materializeRes = await app.inject({
      method: "POST",
      url: "/recurrences/materialize",
      headers: { Authorization: `Bearer ${token}` },
      payload: { untilDate: "2099-01-12" },
    });

    expect(materializeRes.statusCode).toBe(200);
    expect(materializeRes.json()).toMatchObject({
      createdOccurrences: 2,
      createdTransactions: 2,
      skippedOccurrences: 0,
      failedRecurrences: 0,
    });

    const occurrences = await app.db
      .select({
        status: recurrenceOccurrences.status,
        occurrenceDate: recurrenceOccurrences.occurrenceDate,
        transactionId: recurrenceOccurrences.transactionId,
        version: recurrenceOccurrences.version,
      })
      .from(recurrenceOccurrences)
      .where(eq(recurrenceOccurrences.recurrenceId, recurrence.id))
      .orderBy(asc(recurrenceOccurrences.occurrenceDate));

    expect(occurrences).toHaveLength(2);
    expect(occurrences.map((occurrence) => occurrence.status)).toEqual([
      "materialized",
      "materialized",
    ]);
    expect(occurrences.every((occurrence) => occurrence.transactionId)).toBe(true);
    expect(occurrences.every((occurrence) => occurrence.version === 1)).toBe(true);

    const [updatedRecurrence] = await app.db
      .select({
        nextOccurrenceDate: recurrences.nextOccurrenceDate,
        lastMaterializedDate: recurrences.lastMaterializedDate,
      })
      .from(recurrences)
      .where(eq(recurrences.id, recurrence.id));

    expect(updatedRecurrence?.nextOccurrenceDate).toBe("2099-01-19");
    expect(updatedRecurrence?.lastMaterializedDate).toBe("2099-01-12");
  });

  it("gera pendência sem criar transação quando postingMode exige revisão", async () => {
    const { token, account, category } = await createBaseContext();
    const recurrence = await createTransactionRecurrence({
      token,
      accountId: account.id,
      categoryId: category.id,
      postingMode: "review_required",
      startDate: "2025-01-06",
      dayOfWeek: 1,
    });

    const materializeRes = await app.inject({
      method: "POST",
      url: "/recurrences/materialize",
      headers: { Authorization: `Bearer ${token}` },
      payload: { untilDate: "2025-01-06" },
    });

    expect(materializeRes.statusCode).toBe(200);
    expect(materializeRes.json().createdOccurrences).toBe(1);
    expect(materializeRes.json().createdTransactions).toBe(0);

    const [occurrence] = await app.db
      .select()
      .from(recurrenceOccurrences)
      .where(eq(recurrenceOccurrences.recurrenceId, recurrence.id));

    expect(occurrence?.status).toBe("pending_review");
    expect(occurrence?.transactionId).toBeNull();
    expect(occurrence?.reviewPayload).toMatchObject({
      occurrenceDate: "2025-01-06",
      originalScheduledDate: "2025-01-06",
      originType: "transaction",
      amount: 120,
      accountId: account.id,
      categoryId: category.id,
    });

    const persistedTransactions = await app.db
      .select({ id: transactions.id })
      .from(transactions)
      .where(eq(transactions.description, "Despesa recorrente"));
    expect(persistedTransactions.length).toBe(0);

    const [updatedRecurrence] = await app.db
      .select({
        nextOccurrenceDate: recurrences.nextOccurrenceDate,
        lastMaterializedDate: recurrences.lastMaterializedDate,
      })
      .from(recurrences)
      .where(eq(recurrences.id, recurrence.id));

    expect(updatedRecurrence?.nextOccurrenceDate).toBe("2025-01-13");
    expect(updatedRecurrence?.lastMaterializedDate).toBeNull();
  });

  it("gera pendência de transferencia sem criar transacao quando postingMode exige revisão", async () => {
    const { token, account, account2 } = await createBaseContext();
    const transferRecurrenceRes = await app.inject({
      method: "POST",
      url: "/recurrences",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        originType: "transfer",
        postingMode: "review_required",
        frequency: "monthly",
        startDate: "2025-01-15",
        dayOfMonth: 15,
        endType: "never",
        fromAccountId: account.id,
        toAccountId: account2.id,
        amount: 400,
        description: "Transferência recorrente",
      },
    });

    expect(transferRecurrenceRes.statusCode).toBe(201);
    const recurrence = transferRecurrenceRes.json();

    const materializeRes = await app.inject({
      method: "POST",
      url: "/recurrences/materialize",
      headers: { Authorization: `Bearer ${token}` },
      payload: { untilDate: "2025-01-15" },
    });

    expect(materializeRes.statusCode).toBe(200);
    expect(materializeRes.json().createdOccurrences).toBe(1);
    expect(materializeRes.json().createdTransactions).toBe(0);

    const [occurrence] = await app.db
      .select()
      .from(recurrenceOccurrences)
      .where(eq(recurrenceOccurrences.recurrenceId, recurrence.id));

    expect(occurrence?.status).toBe("pending_review");
    expect(occurrence?.reviewPayload).toMatchObject({
      occurrenceDate: "2025-01-15",
      originalScheduledDate: "2025-01-15",
      originType: "transfer",
      amount: 400,
      fromAccountId: account.id,
      toAccountId: account2.id,
    });
    expect(occurrence?.transactionId).toBeNull();
    expect(occurrence?.transferId).toBeNull();
  });

  it("conta pendências no limite by_occurrences em modo de revisão", async () => {
    const { token, account, category } = await createBaseContext();
    const recurrence = await createTransactionRecurrence({
      token,
      accountId: account.id,
      categoryId: category.id,
      postingMode: "review_required",
      startDate: "2025-01-06",
      dayOfWeek: 1,
      endType: "by_occurrences",
      endOccurrences: 3,
    });

    const results = [] as Array<{
      createdOccurrences: number;
      createdTransactions: number;
      finalizedRecurrences: number;
    }>;
    for (let index = 0; index < 5; index += 1) {
      const materializeRes = await app.inject({
        method: "POST",
        url: "/recurrences/materialize",
        headers: { Authorization: `Bearer ${token}` },
        payload: { untilDate: "2025-02-10" },
      });

      expect(materializeRes.statusCode).toBe(200);
      results.push(materializeRes.json());
    }

    expect(results.map((result) => result.createdOccurrences)).toEqual([3, 0, 0, 0, 0]);
    expect(results.every((result) => result.createdTransactions === 0)).toBe(true);
    // Recorrência permanece ativa enquanto houver pendências em aberto (RCREV-DEF-16):
    // a finalização automática só ocorre depois que todas forem confirmadas/ignoradas.
    expect(results.every((result) => result.finalizedRecurrences === 0)).toBe(true);

    const occurrences = await app.db
      .select({ status: recurrenceOccurrences.status })
      .from(recurrenceOccurrences)
      .where(eq(recurrenceOccurrences.recurrenceId, recurrence.id));
    expect(occurrences).toHaveLength(3);
    expect(occurrences.every((occurrence) => occurrence.status === "pending_review")).toBe(true);

    const [updatedRecurrence] = await app.db
      .select({ status: recurrences.status, nextOccurrenceDate: recurrences.nextOccurrenceDate })
      .from(recurrences)
      .where(eq(recurrences.id, recurrence.id));
    expect(updatedRecurrence?.status).toBe("active");
  });

  it("confirma pendência de transação com lock otimista e ajustes", async () => {
    const { token, account, category, category2 } = await createBaseContext();
    const recurrence = await createTransactionRecurrence({
      token,
      accountId: account.id,
      categoryId: category.id,
      postingMode: "review_required",
      startDate: "2025-01-06",
      dayOfWeek: 1,
    });

    const materializeRes = await app.inject({
      method: "POST",
      url: "/recurrences/materialize",
      headers: { Authorization: `Bearer ${token}` },
      payload: { untilDate: "2025-01-06" },
    });
    expect(materializeRes.statusCode).toBe(200);

    const [pending] = await app.db
      .select()
      .from(recurrenceOccurrences)
      .where(eq(recurrenceOccurrences.recurrenceId, recurrence.id));
    expect(pending.status).toBe("pending_review");

    const confirmRes = await app.inject({
      method: "POST",
      url: `/recurrences/occurrences/${pending.id}/confirm`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        expectedVersion: pending.version,
        occurrenceDate: "2025-01-07",
        amount: 150,
        categoryId: category2.id,
        description: "Despesa ajustada",
      },
    });

    expect(confirmRes.statusCode).toBe(200);
    const confirmed = confirmRes.json();
    expect(confirmed.status).toBe("materialized");
    expect(confirmed.version).toBe(pending.version + 1);
    expect(confirmed.transactionId).toBeTruthy();

    const [createdTransaction] = await app.db
      .select()
      .from(transactions)
      .where(eq(transactions.id, confirmed.transactionId));
    expect(createdTransaction.date).toBe("2025-01-07");
    expect(Number(createdTransaction.amount)).toBe(150);
    expect(createdTransaction.categoryId).toBe(category2.id);
    expect(createdTransaction.description).toBe("Despesa ajustada");

    const [updatedOccurrence] = await app.db
      .select()
      .from(recurrenceOccurrences)
      .where(eq(recurrenceOccurrences.id, pending.id));
    expect(updatedOccurrence.status).toBe("materialized");
    expect(updatedOccurrence.transactionId).toBe(createdTransaction.id);
    expect(updatedOccurrence.metadata).toMatchObject({
      adjustments: {
        fields: expect.arrayContaining(["occurrenceDate", "amount", "description", "categoryId"]),
        adjustedAt: expect.any(String),
      },
    });
  });

  it("confirma pendência de transação e cria lançamento materializado", async () => {
    const { token, account, category } = await createBaseContext();
    const recurrence = await createTransactionRecurrence({
      token,
      accountId: account.id,
      categoryId: category.id,
      postingMode: "review_required",
      startDate: "2025-01-06",
      dayOfWeek: 1,
    });

    const materializeRes = await app.inject({
      method: "POST",
      url: "/recurrences/materialize",
      headers: { Authorization: `Bearer ${token}` },
      payload: { untilDate: "2025-01-06" },
    });
    expect(materializeRes.statusCode).toBe(200);

    const [pending] = await app.db
      .select()
      .from(recurrenceOccurrences)
      .where(eq(recurrenceOccurrences.recurrenceId, recurrence.id));

    const confirmRes = await app.inject({
      method: "POST",
      url: `/recurrences/occurrences/${pending.id}/confirm`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { expectedVersion: pending.version },
    });

    expect(confirmRes.statusCode).toBe(200);
    const confirmed = confirmRes.json();
    expect(confirmed.status).toBe("materialized");
    expect(confirmed.transactionId).toBeTruthy();
    expect(confirmed.version).toBe(pending.version + 1);

    const [createdTransaction] = await app.db
      .select()
      .from(transactions)
      .where(eq(transactions.id, confirmed.transactionId));

    expect(createdTransaction).toBeTruthy();
    expect(createdTransaction?.description).toBe("Despesa recorrente");
    expect(createdTransaction?.accountId).toBe(account.id);
    expect(Number(createdTransaction?.amount)).toBe(120);
  });

  it("rejeita confirm com occurrenceDate fora do range permitido", async () => {
    const { token, account, category } = await createBaseContext();
    const recurrence = await createTransactionRecurrence({
      token,
      accountId: account.id,
      categoryId: category.id,
      postingMode: "review_required",
      startDate: "2025-01-06",
      dayOfWeek: 1,
      endType: "until_date",
      endDate: "2025-01-20",
    });

    const materializeRes = await app.inject({
      method: "POST",
      url: "/recurrences/materialize",
      headers: { Authorization: `Bearer ${token}` },
      payload: { untilDate: "2025-01-06" },
    });
    expect(materializeRes.statusCode).toBe(200);

    const [pending] = await app.db
      .select()
      .from(recurrenceOccurrences)
      .where(eq(recurrenceOccurrences.recurrenceId, recurrence.id));

    const confirmRes = await app.inject({
      method: "POST",
      url: `/recurrences/occurrences/${pending.id}/confirm`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        expectedVersion: pending.version,
        occurrenceDate: "2025-01-21",
      },
    });

    expect(confirmRes.statusCode).toBe(422);
    expect(confirmRes.json().detail).toContain("2025-01-06");
    expect(confirmRes.json().detail).toContain("2025-01-20");

    const [afterFailedConfirm] = await app.db
      .select({
        status: recurrenceOccurrences.status,
        transactionId: recurrenceOccurrences.transactionId,
        version: recurrenceOccurrences.version,
      })
      .from(recurrenceOccurrences)
      .where(eq(recurrenceOccurrences.id, pending.id));

    expect(afterFailedConfirm?.status).toBe("pending_review");
    expect(afterFailedConfirm?.transactionId).toBeNull();
    expect(afterFailedConfirm?.version).toBe(pending.version);
  });

  it("confirm aceita occurrenceDate dentro do horizonte operacional em recorrencia never", async () => {
    const { token, account, category } = await createBaseContext();
    const recurrence = await createTransactionRecurrence({
      token,
      accountId: account.id,
      categoryId: category.id,
      postingMode: "review_required",
      startDate: "2026-03-10",
      dayOfWeek: 2,
      endType: "never",
    });

    const materializeRes = await app.inject({
      method: "POST",
      url: "/recurrences/materialize",
      headers: { Authorization: `Bearer ${token}` },
      payload: { untilDate: "2026-03-10" },
    });
    expect(materializeRes.statusCode).toBe(200);

    const [pending] = await app.db
      .select()
      .from(recurrenceOccurrences)
      .where(eq(recurrenceOccurrences.recurrenceId, recurrence.id));

    const confirmRes = await app.inject({
      method: "POST",
      url: `/recurrences/occurrences/${pending.id}/confirm`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        expectedVersion: pending.version,
        occurrenceDate: "2027-02-10",
      },
    });

    expect(confirmRes.statusCode).toBe(200);
    const confirmed = confirmRes.json();
    expect(confirmed.status).toBe("materialized");
    expect(confirmed.transactionId).toBeTruthy();

    const [createdTransaction] = await app.db
      .select({ date: transactions.date })
      .from(transactions)
      .where(eq(transactions.id, confirmed.transactionId));

    expect(createdTransaction?.date).toBe("2027-02-10");
  });

  it("confirm rejeita occurrenceDate além do horizonte operacional em recorrencia never", async () => {
    const { token, account, category } = await createBaseContext();
    const recurrence = await createTransactionRecurrence({
      token,
      accountId: account.id,
      categoryId: category.id,
      postingMode: "review_required",
      startDate: "2026-03-10",
      dayOfWeek: 2,
      endType: "never",
    });

    const materializeRes = await app.inject({
      method: "POST",
      url: "/recurrences/materialize",
      headers: { Authorization: `Bearer ${token}` },
      payload: { untilDate: "2026-03-10" },
    });
    expect(materializeRes.statusCode).toBe(200);

    const [pending] = await app.db
      .select()
      .from(recurrenceOccurrences)
      .where(eq(recurrenceOccurrences.recurrenceId, recurrence.id));

    const confirmRes = await app.inject({
      method: "POST",
      url: `/recurrences/occurrences/${pending.id}/confirm`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        expectedVersion: pending.version,
        occurrenceDate: "2027-04-10",
      },
    });

    expect(confirmRes.statusCode).toBe(422);
    expect(confirmRes.json().detail).toContain("2026-03-10");
    expect(confirmRes.json().detail).toContain("2027-03-10");
  });

  it("confirm aceita occurrenceDate distante em by_occurrences sem teto de 1 ano", async () => {
    const { token, account, category } = await createBaseContext();
    const recurrence = await createTransactionRecurrence({
      token,
      accountId: account.id,
      categoryId: category.id,
      postingMode: "review_required",
      frequency: "monthly",
      startDate: "2025-03-10",
      dayOfMonth: 10,
      endType: "by_occurrences",
      endOccurrences: 24,
    });

    const materializeRes = await app.inject({
      method: "POST",
      url: "/recurrences/materialize",
      headers: { Authorization: `Bearer ${token}` },
      payload: { untilDate: "2026-05-10" },
    });
    expect(materializeRes.statusCode).toBe(200);

    const [pending] = await app.db
      .select()
      .from(recurrenceOccurrences)
      .where(
        and(
          eq(recurrenceOccurrences.recurrenceId, recurrence.id),
          eq(recurrenceOccurrences.occurrenceDate, "2026-05-10"),
        ),
      );

    expect(pending?.status).toBe("pending_review");

    const confirmRes = await app.inject({
      method: "POST",
      url: `/recurrences/occurrences/${pending.id}/confirm`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        expectedVersion: pending.version,
        occurrenceDate: "2026-04-10",
      },
    });

    expect(confirmRes.statusCode).toBe(200);
    const confirmed = confirmRes.json();
    expect(confirmed.status).toBe("materialized");
    expect(confirmed.transactionId).toBeTruthy();

    const [createdTransaction] = await app.db
      .select({ date: transactions.date })
      .from(transactions)
      .where(eq(transactions.id, confirmed.transactionId));

    expect(createdTransaction?.date).toBe("2026-04-10");
  });

  it("confirm rejeita occurrenceDate anterior ao startDate em by_occurrences", async () => {
    const { token, account, category } = await createBaseContext();
    const recurrence = await createTransactionRecurrence({
      token,
      accountId: account.id,
      categoryId: category.id,
      postingMode: "review_required",
      frequency: "monthly",
      startDate: "2025-03-10",
      dayOfMonth: 10,
      endType: "by_occurrences",
      endOccurrences: 24,
    });

    const materializeRes = await app.inject({
      method: "POST",
      url: "/recurrences/materialize",
      headers: { Authorization: `Bearer ${token}` },
      payload: { untilDate: "2026-05-10" },
    });
    expect(materializeRes.statusCode).toBe(200);

    const [pending] = await app.db
      .select()
      .from(recurrenceOccurrences)
      .where(
        and(
          eq(recurrenceOccurrences.recurrenceId, recurrence.id),
          eq(recurrenceOccurrences.occurrenceDate, "2026-05-10"),
        ),
      );

    expect(pending?.status).toBe("pending_review");

    const confirmRes = await app.inject({
      method: "POST",
      url: `/recurrences/occurrences/${pending.id}/confirm`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        expectedVersion: pending.version,
        occurrenceDate: "2025-03-09",
      },
    });

    expect(confirmRes.statusCode).toBe(422);
    expect(confirmRes.json().detail).toBe("A data ajustada não pode ser anterior a 2025-03-10.");
  });

  it(
    "retorna mensagens em pt-BR para erros críticos de confirm e update",
    async () => {
      const { token, account, category } = await createBaseContext();

      const rangeRecurrence = await createTransactionRecurrence({
        token,
        accountId: account.id,
        categoryId: category.id,
        postingMode: "review_required",
        startDate: "2025-01-06",
        dayOfWeek: 1,
        endType: "until_date",
        endDate: "2025-01-20",
      });

      const rangeMaterializeRes = await app.inject({
        method: "POST",
        url: "/recurrences/materialize",
        headers: { Authorization: `Bearer ${token}` },
        payload: { untilDate: "2025-01-06" },
      });
      expect(rangeMaterializeRes.statusCode).toBe(200);

      const [rangePending] = await app.db
        .select()
        .from(recurrenceOccurrences)
        .where(eq(recurrenceOccurrences.recurrenceId, rangeRecurrence.id));

      const rangeConfirm = await app.inject({
        method: "POST",
        url: `/recurrences/occurrences/${rangePending.id}/confirm`,
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          expectedVersion: rangePending.version,
          occurrenceDate: "2025-01-21",
        },
      });

      expect(rangeConfirm.statusCode).toBe(422);
      expect(rangeConfirm.json().detail).toBe(
        "A data ajustada deve estar entre 2025-01-06 e 2025-01-20.",
      );

      const confirmRecurrence = await createTransactionRecurrence({
        token,
        accountId: account.id,
        categoryId: category.id,
        postingMode: "review_required",
        startDate: "2025-01-06",
        dayOfWeek: 1,
      });

      const confirmMaterializeRes = await app.inject({
        method: "POST",
        url: "/recurrences/materialize",
        headers: { Authorization: `Bearer ${token}` },
        payload: { untilDate: "2025-01-06" },
      });
      expect(confirmMaterializeRes.statusCode).toBe(200);

      const [confirmPending] = await app.db
        .select()
        .from(recurrenceOccurrences)
        .where(eq(recurrenceOccurrences.recurrenceId, confirmRecurrence.id));

      const firstConfirm = await app.inject({
        method: "POST",
        url: `/recurrences/occurrences/${confirmPending.id}/confirm`,
        headers: { Authorization: `Bearer ${token}` },
        payload: { expectedVersion: confirmPending.version },
      });
      expect(firstConfirm.statusCode).toBe(200);

      const staleConfirm = await app.inject({
        method: "POST",
        url: `/recurrences/occurrences/${confirmPending.id}/confirm`,
        headers: { Authorization: `Bearer ${token}` },
        payload: { expectedVersion: confirmPending.version },
      });
      expect(staleConfirm.statusCode).toBe(409);
      expect(staleConfirm.json().detail).toBe(
        "Esta pendência já foi processada por outra requisição. Atualize a página e tente novamente.",
      );

      const updateRecurrence = await createTransactionRecurrence({
        token,
        accountId: account.id,
        categoryId: category.id,
        startDate: "2099-01-06",
        dayOfWeek: 1,
      });

      const firstUpdate = await app.inject({
        method: "PUT",
        url: `/recurrences/${updateRecurrence.id}`,
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          amount: 130,
          expectedVersion: updateRecurrence.version,
        },
      });
      expect(firstUpdate.statusCode).toBe(200);

      const staleUpdate = await app.inject({
        method: "PUT",
        url: `/recurrences/${updateRecurrence.id}`,
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          amount: 140,
          expectedVersion: updateRecurrence.version,
        },
      });
      expect(staleUpdate.statusCode).toBe(409);
      expect(staleUpdate.json().detail).toBe(
        "A recorrência foi alterada por outra sessão. Recarregue e tente novamente.",
      );
    },
    30_000,
  );

  it("rejeita confirmação duplicada com 409", async () => {
    const { token, account, category } = await createBaseContext();
    const recurrence = await createTransactionRecurrence({
      token,
      accountId: account.id,
      categoryId: category.id,
      postingMode: "review_required",
      startDate: "2025-01-06",
      dayOfWeek: 1,
    });

    const materializeRes = await app.inject({
      method: "POST",
      url: "/recurrences/materialize",
      headers: { Authorization: `Bearer ${token}` },
      payload: { untilDate: "2025-01-06" },
    });
    expect(materializeRes.statusCode).toBe(200);

    const [pending] = await app.db
      .select()
      .from(recurrenceOccurrences)
      .where(eq(recurrenceOccurrences.recurrenceId, recurrence.id));

    const firstConfirm = await app.inject({
      method: "POST",
      url: `/recurrences/occurrences/${pending.id}/confirm`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { expectedVersion: pending.version },
    });
    expect(firstConfirm.statusCode).toBe(200);

    const staleConfirm = await app.inject({
      method: "POST",
      url: `/recurrences/occurrences/${pending.id}/confirm`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { expectedVersion: pending.version },
    });
    expect(staleConfirm.statusCode).toBe(409);
    expect(staleConfirm.json().detail).toContain("já foi processada");
  });

  it("rejeita confirm concorrente com 409 para a segunda requisição", async () => {
    const { token, account, category } = await createBaseContext();
    const recurrence = await createTransactionRecurrence({
      token,
      accountId: account.id,
      categoryId: category.id,
      postingMode: "review_required",
      startDate: "2025-01-06",
      dayOfWeek: 1,
    });

    const materializeRes = await app.inject({
      method: "POST",
      url: "/recurrences/materialize",
      headers: { Authorization: `Bearer ${token}` },
      payload: { untilDate: "2025-01-06" },
    });
    expect(materializeRes.statusCode).toBe(200);

    const [pending] = await app.db
      .select()
      .from(recurrenceOccurrences)
      .where(eq(recurrenceOccurrences.recurrenceId, recurrence.id));

    const rollbackMarker = `Confirm concurrency ${crypto.randomUUID()}`;
    const suffix = crypto.randomUUID().replace(/-/g, "");
    const fnName = `sleep_confirm_concurrency_${suffix}`;
    const triggerName = `trg_sleep_confirm_concurrency_${suffix}`;

    try {
      await app.db.execute(
        sql.raw(`
          create function ${fnName}()
          returns trigger
          language plpgsql
          as $$
          begin
            if NEW.description = '${rollbackMarker}' and NEW.type = 'expense' then
              perform pg_sleep(1);
            end if;
            return NEW;
          end;
          $$;
        `),
      );
      await app.db.execute(
        sql.raw(`
          create trigger ${triggerName}
          before insert on transactions
          for each row
          execute function ${fnName}();
        `),
      );

      const firstConfirmPromise = app.inject({
        method: "POST",
        url: `/recurrences/occurrences/${pending.id}/confirm`,
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          expectedVersion: pending.version,
          description: rollbackMarker,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const secondConfirmPromise = app.inject({
        method: "POST",
        url: `/recurrences/occurrences/${pending.id}/confirm`,
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          expectedVersion: pending.version,
          description: rollbackMarker,
        },
      });

      const [firstConfirm, secondConfirm] = await Promise.all([
        firstConfirmPromise,
        secondConfirmPromise,
      ]);

      expect([firstConfirm.statusCode, secondConfirm.statusCode].sort()).toEqual([200, 409]);
      const conflictResponse = firstConfirm.statusCode === 409 ? firstConfirm : secondConfirm;
      expect(conflictResponse.json().detail).toContain("já foi processada");

      const [currentOccurrence] = await app.db
        .select({
          status: recurrenceOccurrences.status,
          version: recurrenceOccurrences.version,
          transactionId: recurrenceOccurrences.transactionId,
        })
        .from(recurrenceOccurrences)
        .where(eq(recurrenceOccurrences.id, pending.id));

      expect(currentOccurrence?.status).toBe("materialized");
      expect(currentOccurrence?.version).toBe(pending.version + 1);
      expect(currentOccurrence?.transactionId).toBeTruthy();
    } finally {
      await app.db.execute(
        sql.raw(`
          drop trigger if exists ${triggerName} on transactions;
          drop function if exists ${fnName}();
        `),
      );
    }
  });

  it("ignora pendência sem criar transação e grava motivo", async () => {
    const { token, account, category } = await createBaseContext();
    const recurrence = await createTransactionRecurrence({
      token,
      accountId: account.id,
      categoryId: category.id,
      postingMode: "review_required",
      startDate: "2025-01-06",
      dayOfWeek: 1,
    });

    const materializeRes = await app.inject({
      method: "POST",
      url: "/recurrences/materialize",
      headers: { Authorization: `Bearer ${token}` },
      payload: { untilDate: "2025-01-06" },
    });
    expect(materializeRes.statusCode).toBe(200);

    const [pending] = await app.db
      .select()
      .from(recurrenceOccurrences)
      .where(eq(recurrenceOccurrences.recurrenceId, recurrence.id));

    const skipRes = await app.inject({
      method: "POST",
      url: `/recurrences/occurrences/${pending.id}/skip`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { expectedVersion: pending.version, reason: "Não aconteceu" },
    });

    expect(skipRes.statusCode).toBe(200);
    const skipped = skipRes.json();
    expect(skipped.status).toBe("skipped");
    expect(skipped.version).toBe(pending.version + 1);
    expect(skipped.transactionId).toBeNull();
    expect(skipped.transferId).toBeNull();
    expect(skipped.metadata).toMatchObject({
      skipReason: "Não aconteceu",
    });
    expect(skipped.metadata.skippedAt).toBeTruthy();

    const createdTransactions = await app.db
      .select()
      .from(transactions)
      .where(eq(transactions.description, "Despesa recorrente"));
    expect(createdTransactions).toHaveLength(0);
  });

  it("rejeita skip duplicado com 409", async () => {
    const { token, account, category } = await createBaseContext();
    const recurrence = await createTransactionRecurrence({
      token,
      accountId: account.id,
      categoryId: category.id,
      postingMode: "review_required",
      startDate: "2025-01-06",
      dayOfWeek: 1,
    });

    const materializeRes = await app.inject({
      method: "POST",
      url: "/recurrences/materialize",
      headers: { Authorization: `Bearer ${token}` },
      payload: { untilDate: "2025-01-06" },
    });
    expect(materializeRes.statusCode).toBe(200);

    const [pending] = await app.db
      .select()
      .from(recurrenceOccurrences)
      .where(eq(recurrenceOccurrences.recurrenceId, recurrence.id));

    const firstSkip = await app.inject({
      method: "POST",
      url: `/recurrences/occurrences/${pending.id}/skip`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { expectedVersion: pending.version },
    });
    expect(firstSkip.statusCode).toBe(200);

    const staleSkip = await app.inject({
      method: "POST",
      url: `/recurrences/occurrences/${pending.id}/skip`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { expectedVersion: pending.version },
    });
    expect(staleSkip.statusCode).toBe(409);
    expect(staleSkip.json().detail).toContain("já foi processada");
  });

  it("faz skip consumir o limite by_occurrences", async () => {
    const { token, account, category } = await createBaseContext();
    const recurrence = await createTransactionRecurrence({
      token,
      accountId: account.id,
      categoryId: category.id,
      postingMode: "review_required",
      startDate: "2025-01-06",
      dayOfWeek: 1,
      endType: "by_occurrences",
      endOccurrences: 2,
    });

    const firstMaterialize = await app.inject({
      method: "POST",
      url: "/recurrences/materialize",
      headers: { Authorization: `Bearer ${token}` },
      payload: { untilDate: "2025-01-06" },
    });
    expect(firstMaterialize.statusCode).toBe(200);
    expect(firstMaterialize.json().createdOccurrences).toBe(1);
    expect(firstMaterialize.json().createdTransactions).toBe(0);

    const [pending] = await app.db
      .select()
      .from(recurrenceOccurrences)
      .where(eq(recurrenceOccurrences.recurrenceId, recurrence.id));

    const skipRes = await app.inject({
      method: "POST",
      url: `/recurrences/occurrences/${pending.id}/skip`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { expectedVersion: pending.version, reason: "Não ocorreu" },
    });
    expect(skipRes.statusCode).toBe(200);

    const secondMaterialize = await app.inject({
      method: "POST",
      url: "/recurrences/materialize",
      headers: { Authorization: `Bearer ${token}` },
      payload: { untilDate: "2025-02-10" },
    });

    expect(secondMaterialize.statusCode).toBe(200);
    expect(secondMaterialize.json().createdOccurrences).toBe(1);
    expect(secondMaterialize.json().createdTransactions).toBe(0);
    expect(secondMaterialize.json().skippedOccurrences).toBe(0);

    const occurrences = await app.db
      .select({
        status: recurrenceOccurrences.status,
        occurrenceDate: recurrenceOccurrences.occurrenceDate,
      })
      .from(recurrenceOccurrences)
      .where(eq(recurrenceOccurrences.recurrenceId, recurrence.id))
      .orderBy(asc(recurrenceOccurrences.occurrenceDate));

    expect(occurrences).toHaveLength(2);
    expect(occurrences.map((occurrence) => occurrence.status)).toEqual([
      "skipped",
      "pending_review",
    ]);

    const [updatedRecurrence] = await app.db
      .select({
        status: recurrences.status,
        nextOccurrenceDate: recurrences.nextOccurrenceDate,
      })
      .from(recurrences)
      .where(eq(recurrences.id, recurrence.id));

    expect(updatedRecurrence?.status).toBe("active");
    expect(updatedRecurrence?.nextOccurrenceDate).toBe("2025-01-20");
  });

  it("retorna timeline com persistidas, projetadas, sequência e ações", async () => {
    const { token, account, category } = await createBaseContext();
    const recurrence = await createTransactionRecurrence({
      token,
      accountId: account.id,
      categoryId: category.id,
      postingMode: "review_required",
      startDate: "2025-01-06",
      dayOfWeek: 1,
      endType: "by_occurrences",
      endOccurrences: 4,
    });

    const materializeRes = await app.inject({
      method: "POST",
      url: "/recurrences/materialize",
      headers: { Authorization: `Bearer ${token}` },
      payload: { untilDate: "2025-01-20" },
    });
    expect(materializeRes.statusCode).toBe(200);

    const [firstPending, secondPending, thirdPending] = await app.db
      .select()
      .from(recurrenceOccurrences)
      .where(eq(recurrenceOccurrences.recurrenceId, recurrence.id))
      .orderBy(asc(recurrenceOccurrences.occurrenceDate));

    const confirmRes = await app.inject({
      method: "POST",
      url: `/recurrences/occurrences/${firstPending.id}/confirm`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { expectedVersion: firstPending.version },
    });
    expect(confirmRes.statusCode).toBe(200);

    const skipRes = await app.inject({
      method: "POST",
      url: `/recurrences/occurrences/${secondPending.id}/skip`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { expectedVersion: secondPending.version, reason: "Não ocorreu" },
    });
    expect(skipRes.statusCode).toBe(200);

    const timelineRes = await app.inject({
      method: "GET",
      url: `/recurrences/${recurrence.id}/timeline`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(timelineRes.statusCode).toBe(200);
    const timeline = timelineRes.json();

    expect(timeline.summary).toMatchObject({
      totalOccurrences: 4,
      consumedOccurrences: 3,
      materializedOccurrences: 1,
      pendingReviewOccurrences: 1,
      skippedOccurrences: 1,
      failedOccurrences: 0,
      projectedOccurrences: 1,
      totalAmount: 480,
      materializedAmount: 120,
      pendingReviewAmount: 120,
      projectedAmount: 120,
      appliedLimit: 12,
      isPartial: false,
      hasMoreProjected: false,
      projectionWindowLabel: null,
    });

    expect(timeline.items).toHaveLength(4);
    expect(timeline.items.map((item: { status: string }) => item.status)).toEqual([
      "materialized",
      "skipped",
      "pending_review",
      "projected",
    ]);
    expect(timeline.items.map((item: { sequence: number | null }) => item.sequence)).toEqual([
      1, 2, 3, 4,
    ]);
    expect(timeline.items[1].version).toBe(2);
    expect(timeline.items[1].reviewPayload).toMatchObject({
      occurrenceDate: "2025-01-13",
      originalScheduledDate: "2025-01-13",
      originType: "transaction",
      amount: 120,
    });
    expect(timeline.items[2].canConfirm).toBe(true);
    expect(timeline.items[2].canSkip).toBe(true);
    expect(timeline.items[0].canConfirm).toBe(false);
    expect(timeline.items[1].canSkip).toBe(false);
    expect(timeline.items[3].source).toBe("projected");
    expect(timeline.items[3].id).toBeNull();
    expect(timeline.items[3].transactionId).toBeNull();
    expect(timeline.items[3].transferId).toBeNull();
    expect(timeline.items[0].transactionId).toBeTruthy();
    expect(timeline.items[1].transactionId).toBeNull();
    expect(timeline.items[2].transactionId).toBeNull();
    expect(secondPending.id).toBeTruthy();
    expect(thirdPending.id).toBeTruthy();
  });

  it("retorna timeline com persistidas e projetadas em recorrência automatic", async () => {
    const { token, account, category } = await createBaseContext();
    const recurrence = await createTransactionRecurrence({
      token,
      accountId: account.id,
      categoryId: category.id,
      postingMode: "automatic",
      startDate: "2099-01-05",
      dayOfWeek: 1,
      endType: "by_occurrences",
      endOccurrences: 4,
    });

    const materializeRes = await app.inject({
      method: "POST",
      url: "/recurrences/materialize",
      headers: { Authorization: `Bearer ${token}` },
      payload: { untilDate: "2099-01-12" },
    });
    expect(materializeRes.statusCode).toBe(200);
    expect(materializeRes.json()).toMatchObject({
      createdOccurrences: 2,
      createdTransactions: 2,
      skippedOccurrences: 0,
    });

    const timelineRes = await app.inject({
      method: "GET",
      url: `/recurrences/${recurrence.id}/timeline`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(timelineRes.statusCode).toBe(200);
    const timeline = timelineRes.json();

    expect(timeline.summary).toMatchObject({
      totalOccurrences: 4,
      consumedOccurrences: 2,
      materializedOccurrences: 2,
      pendingReviewOccurrences: 0,
      skippedOccurrences: 0,
      failedOccurrences: 0,
      projectedOccurrences: 2,
      totalAmount: 480,
      materializedAmount: 240,
      pendingReviewAmount: 0,
      projectedAmount: 240,
      appliedLimit: 12,
      isPartial: false,
      hasMoreProjected: false,
      projectionWindowLabel: null,
    });

    expect(timeline.items).toHaveLength(4);
    expect(timeline.items.map((item: { status: string }) => item.status)).toEqual([
      "materialized",
      "materialized",
      "projected",
      "projected",
    ]);
    expect(timeline.items.map((item: { sequence: number | null }) => item.sequence)).toEqual([
      1, 2, 3, 4,
    ]);
    expect(
      timeline.items.slice(0, 2).every((item: { source: string }) => item.source === "persisted"),
    ).toBe(true);
    expect(
      timeline.items.slice(2).every((item: { source: string }) => item.source === "projected"),
    ).toBe(true);
  });

  it("mantem skipped ocupando posicao na sequence da timeline", async () => {
    const { token, account, category } = await createBaseContext();
    const recurrence = await createTransactionRecurrence({
      token,
      accountId: account.id,
      categoryId: category.id,
      postingMode: "review_required",
      startDate: "2025-01-06",
      dayOfWeek: 1,
      endType: "by_occurrences",
      endOccurrences: 4,
    });

    const materializeRes = await app.inject({
      method: "POST",
      url: "/recurrences/materialize",
      headers: { Authorization: `Bearer ${token}` },
      payload: { untilDate: "2025-01-20" },
    });
    expect(materializeRes.statusCode).toBe(200);

    const [firstPending, secondPending] = await app.db
      .select()
      .from(recurrenceOccurrences)
      .where(eq(recurrenceOccurrences.recurrenceId, recurrence.id))
      .orderBy(asc(recurrenceOccurrences.occurrenceDate));

    const confirmRes = await app.inject({
      method: "POST",
      url: `/recurrences/occurrences/${firstPending.id}/confirm`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { expectedVersion: firstPending.version },
    });
    expect(confirmRes.statusCode).toBe(200);

    const skipRes = await app.inject({
      method: "POST",
      url: `/recurrences/occurrences/${secondPending.id}/skip`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { expectedVersion: secondPending.version, reason: "Não ocorreu" },
    });
    expect(skipRes.statusCode).toBe(200);

    const timelineRes = await app.inject({
      method: "GET",
      url: `/recurrences/${recurrence.id}/timeline?includeProjected=false`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(timelineRes.statusCode).toBe(200);
    const timeline = timelineRes.json();

    expect(timeline.items.map((item: { status: string }) => item.status)).toEqual([
      "materialized",
      "skipped",
      "pending_review",
    ]);
    expect(timeline.items.map((item: { sequence: number | null }) => item.sequence)).toEqual([
      1, 2, 3,
    ]);
    expect(timeline.items[1].status).toBe("skipped");
    expect(timeline.items[1].sequence).toBe(2);
    expect(timeline.items[2].sequence).toBe(3);
  });

  it("usa o indice composto no count de pendencias por recorrencia", async () => {
    const { token, user, account, category } = await createBaseContext();
    const recurrence = await createTransactionRecurrence({
      token,
      accountId: account.id,
      categoryId: category.id,
      postingMode: "review_required",
      startDate: "2025-01-06",
      dayOfWeek: 1,
      endType: "by_occurrences",
      endOccurrences: 2,
    });

    const materializeRes = await app.inject({
      method: "POST",
      url: "/recurrences/materialize",
      headers: { Authorization: `Bearer ${token}` },
      payload: { untilDate: "2025-01-13" },
    });
    expect(materializeRes.statusCode).toBe(200);

    await app.db.transaction(async (tx) => {
      const supportRecurrences: Array<{ id: string }> = [];

      for (let index = 0; index < 80; index += 1) {
        const [supportRecurrence] = await tx
          .insert(recurrences)
          .values({
            userId: user.id,
            originType: "transaction",
            status: "active",
            postingMode: "review_required",
            timezone: "UTC",
            frequency: "weekly",
            startDate: "2025-01-06",
            dayOfWeek: 1,
            endType: "by_occurrences",
            endOccurrences: 1,
            accountId: account.id,
            categoryId: category.id,
            amount: "120",
            description: `Carga de apoio ${index + 1}`,
            nextOccurrenceDate: "2025-01-06",
          })
          .returning({ id: recurrences.id });

        supportRecurrences.push(supportRecurrence);
      }

      await tx.insert(recurrenceOccurrences).values(
        supportRecurrences.map((supportRecurrence) => ({
          recurrenceId: supportRecurrence.id,
          originType: "transaction" as const,
          occurrenceDate: "2025-01-06",
          status: "pending_review" as const,
          transactionId: null,
          transferId: null,
          metadata: null,
          reviewPayload: null,
          version: 1,
        })),
      );
    });

    const planText = await app.db.transaction(async (tx) => {
      await tx.execute(sql`set local enable_seqscan = off`);
      await tx.execute(sql`set local enable_bitmapscan = off`);
      await tx.execute(sql`drop index if exists recurrence_occurrences_status_idx`);

      const explainResult = await tx.execute(sql`
        explain (analyze, buffers, costs off)
        select count(*)::int as count
        from ${recurrenceOccurrences}
        where ${recurrenceOccurrences.recurrenceId} = ${recurrence.id}
          and ${recurrenceOccurrences.status} = 'pending_review'
      `);

      const rows = (explainResult as { rows?: Array<Record<string, string>> }).rows ?? [];
      return rows.map((row) => Object.values(row)[0]).join("\n");
    });

    expect(planText).toMatch(
      /Index (Only )?Scan using recurrence_occurrences_recurrence_status_idx/,
    );
    expect(planText).toContain("Index Cond:");
    expect(planText).toContain("status = 'pending_review'::recurrence_occurrence_status");
  });

  it("conta corretamente pendências e projeções na timeline de recorrência review_required", async () => {
    const { token, account, category } = await createBaseContext();
    const recurrence = await createTransactionRecurrence({
      token,
      accountId: account.id,
      categoryId: category.id,
      postingMode: "review_required",
      startDate: "2025-01-06",
      dayOfWeek: 1,
      endType: "by_occurrences",
      endOccurrences: 3,
    });

    const materializeRes = await app.inject({
      method: "POST",
      url: "/recurrences/materialize",
      headers: { Authorization: `Bearer ${token}` },
      payload: { untilDate: "2025-01-20" },
    });
    expect(materializeRes.statusCode).toBe(200);

    const timelineRes = await app.inject({
      method: "GET",
      url: `/recurrences/${recurrence.id}/timeline`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(timelineRes.statusCode).toBe(200);
    const timeline = timelineRes.json();

    expect(timeline.summary).toMatchObject({
      totalOccurrences: 3,
      consumedOccurrences: 3,
      materializedOccurrences: 0,
      pendingReviewOccurrences: 3,
      skippedOccurrences: 0,
      failedOccurrences: 0,
      projectedOccurrences: 0,
      totalAmount: 360,
      materializedAmount: 0,
      pendingReviewAmount: 360,
      projectedAmount: 0,
      appliedLimit: 12,
      isPartial: false,
      hasMoreProjected: false,
      projectionWindowLabel: null,
    });

    expect(timeline.items).toHaveLength(3);
    expect(timeline.items.map((item: { status: string }) => item.status)).toEqual([
      "pending_review",
      "pending_review",
      "pending_review",
    ]);
    expect(
      timeline.items.every(
        (item: { canConfirm: boolean; canSkip: boolean }) => item.canConfirm && item.canSkip,
      ),
    ).toBe(true);
  });

  it("retorna timeline parcial quando a projeção é limitada", async () => {
    const { token, account, category } = await createBaseContext();
    const recurrence = await createTransactionRecurrence({
      token,
      accountId: account.id,
      categoryId: category.id,
      postingMode: "review_required",
      startDate: "2025-01-06",
      dayOfWeek: 1,
      endType: "by_occurrences",
      endOccurrences: 4,
    });

    const materializeRes = await app.inject({
      method: "POST",
      url: "/recurrences/materialize",
      headers: { Authorization: `Bearer ${token}` },
      payload: { untilDate: "2025-01-20" },
    });
    expect(materializeRes.statusCode).toBe(200);

    const timelineRes = await app.inject({
      method: "GET",
      url: `/recurrences/${recurrence.id}/timeline?limit=2&includeProjected=false`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(timelineRes.statusCode).toBe(200);
    const timeline = timelineRes.json();

    expect(timeline.summary).toMatchObject({
      appliedLimit: 2,
      isPartial: true,
      hasMoreProjected: true,
      projectionWindowLabel: "Próximas 2 ocorrências",
      projectedOccurrences: 0,
    });
    expect(timeline.items).toHaveLength(2);
    const sequences = timeline.items.map((item: { sequence: number | null }) => item.sequence);
    expect(sequences).toEqual([1, 2]);
    const allPersisted = timeline.items.every((item: { source: string }) => {
      return item.source === "persisted";
    });
    expect(allPersisted).toBe(true);
  });

  it("bloqueia timeline de outro usuário com 404", async () => {
    const { token, account, category } = await createBaseContext();
    const recurrence = await createTransactionRecurrence({
      token,
      accountId: account.id,
      categoryId: category.id,
      startDate: "2025-01-06",
      dayOfWeek: 1,
    });

    const email = `other_${crypto.randomUUID()}@test.com`;
    const { token: otherToken } = await registerAndLogin(app, app.db, email);

    const timelineRes = await app.inject({
      method: "GET",
      url: `/recurrences/${recurrence.id}/timeline`,
      headers: { Authorization: `Bearer ${otherToken}` },
    });

    expect(timelineRes.statusCode).toBe(404);
  });

  it("confirma pendência de transferência de forma atômica", async () => {
    const { token, account, account2 } = await createBaseContext();
    await app.db.insert(categories).values({
      userId: null,
      name: "Transferência",
      type: "expense",
      system: true,
    });

    const recurrenceRes = await app.inject({
      method: "POST",
      url: "/recurrences",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        originType: "transfer",
        postingMode: "review_required",
        frequency: "monthly",
        startDate: "2025-01-15",
        dayOfMonth: 15,
        endType: "never",
        fromAccountId: account.id,
        toAccountId: account2.id,
        amount: 400,
        description: "Reserva",
      },
    });
    expect(recurrenceRes.statusCode).toBe(201);
    const recurrence = recurrenceRes.json();

    const materializeRes = await app.inject({
      method: "POST",
      url: "/recurrences/materialize",
      headers: { Authorization: `Bearer ${token}` },
      payload: { untilDate: "2025-01-15" },
    });
    expect(materializeRes.statusCode).toBe(200);

    const [pending] = await app.db
      .select()
      .from(recurrenceOccurrences)
      .where(eq(recurrenceOccurrences.recurrenceId, recurrence.id));

    const confirmRes = await app.inject({
      method: "POST",
      url: `/recurrences/occurrences/${pending.id}/confirm`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { expectedVersion: pending.version, amount: 450 },
    });

    expect(confirmRes.statusCode).toBe(200);
    const confirmed = confirmRes.json();
    expect(confirmed.status).toBe("materialized");
    expect(confirmed.transferId).toBeTruthy();

    const transferTransactions = await app.db
      .select()
      .from(transactions)
      .where(eq(transactions.transferId, confirmed.transferId));
    expect(transferTransactions).toHaveLength(2);
    expect(transferTransactions.map((tx) => tx.type).sort()).toEqual(["expense", "income"]);
    expect(transferTransactions.every((tx) => Number(tx.amount) === 450)).toBe(true);
  });

  it("reverte confirm de transferencia quando a segunda perna falha", async () => {
    const { token, account, account2 } = await createBaseContext();
    await app.db.insert(categories).values({
      userId: null,
      name: "Transferência",
      type: "expense",
      system: true,
    });

    const rollbackMarker = `Transfer confirm rollback ${crypto.randomUUID()}`;
    const suffix = crypto.randomUUID().replace(/-/g, "");
    const fnName = `fail_income_transfer_confirm_${suffix}`;
    const triggerName = `trg_fail_income_transfer_confirm_${suffix}`;

    const recurrenceRes = await app.inject({
      method: "POST",
      url: "/recurrences",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        originType: "transfer",
        postingMode: "review_required",
        frequency: "monthly",
        startDate: "2025-01-15",
        dayOfMonth: 15,
        endType: "never",
        fromAccountId: account.id,
        toAccountId: account2.id,
        amount: 400,
        description: rollbackMarker,
      },
    });
    expect(recurrenceRes.statusCode).toBe(201);
    const recurrence = recurrenceRes.json();

    const materializeRes = await app.inject({
      method: "POST",
      url: "/recurrences/materialize",
      headers: { Authorization: `Bearer ${token}` },
      payload: { untilDate: "2025-01-15" },
    });
    expect(materializeRes.statusCode).toBe(200);

    const [pending] = await app.db
      .select()
      .from(recurrenceOccurrences)
      .where(eq(recurrenceOccurrences.recurrenceId, recurrence.id));
    expect(pending?.status).toBe("pending_review");

    try {
      await app.db.execute(
        sql.raw(`
          create function ${fnName}()
          returns trigger
          language plpgsql
          as $$
          begin
            if NEW.description = '${rollbackMarker}' and NEW.type = 'income' then
              raise exception 'forced rollback on confirm income leg';
            end if;
            return NEW;
          end;
          $$;
        `),
      );
      await app.db.execute(
        sql.raw(`
          create trigger ${triggerName}
          before insert on transactions
          for each row
          execute function ${fnName}();
        `),
      );

      const confirmRes = await app.inject({
        method: "POST",
        url: `/recurrences/occurrences/${pending.id}/confirm`,
        headers: { Authorization: `Bearer ${token}` },
        payload: { expectedVersion: pending.version, amount: 450 },
      });

      expect(confirmRes.statusCode).toBe(500);
      expect(confirmRes.json().message ?? confirmRes.json().detail ?? "").not.toContain(
        "Falha ao confirmar transferência recorrente de forma atômica.",
      );

      const [currentOccurrence] = await app.db
        .select({
          status: recurrenceOccurrences.status,
          version: recurrenceOccurrences.version,
          transactionId: recurrenceOccurrences.transactionId,
          transferId: recurrenceOccurrences.transferId,
        })
        .from(recurrenceOccurrences)
        .where(eq(recurrenceOccurrences.id, pending.id));

      expect(currentOccurrence).toMatchObject({
        status: "pending_review",
        version: pending.version,
        transactionId: null,
        transferId: null,
      });

      const persistedTransferTxs = await app.db
        .select({ id: transactions.id })
        .from(transactions)
        .where(eq(transactions.description, rollbackMarker));
      expect(persistedTransferTxs).toHaveLength(0);
    } finally {
      await app.db.execute(
        sql.raw(`
          drop trigger if exists ${triggerName} on transactions;
          drop function if exists ${fnName}();
        `),
      );
    }
  });

  it("bloqueia escopo single quando payload tenta alterar agenda", async () => {
    const { token, account, category } = await createBaseContext();
    const recurrence = await createTransactionRecurrence({
      token,
      accountId: account.id,
      categoryId: category.id,
      startDate: "2099-01-06",
      dayOfWeek: 1,
    });

    const res = await app.inject({
      method: "PUT",
      url: `/recurrences/${recurrence.id}/edit-scope`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        scope: "single",
        occurrenceDate: "2099-01-06",
        changes: { startDate: "2099-01-07" },
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().detail).toContain("Escopo 'single' não permite alterar agenda");
  });

  it("atualiza reviewPayload da pendência em single sem tocar na regra-mae", async () => {
    const { token, account, category, category2 } = await createBaseContext();
    const recurrence = await createTransactionRecurrence({
      token,
      accountId: account.id,
      categoryId: category.id,
      postingMode: "review_required",
      amount: 120,
      startDate: "2026-05-04",
      dayOfWeek: 1,
    });

    const materializeRes = await app.inject({
      method: "POST",
      url: "/recurrences/materialize",
      headers: { Authorization: `Bearer ${token}` },
      payload: { untilDate: "2026-05-04" },
    });
    expect(materializeRes.statusCode).toBe(200);

    const [pendingBefore] = await app.db
      .select()
      .from(recurrenceOccurrences)
      .where(eq(recurrenceOccurrences.recurrenceId, recurrence.id));

    const [recurrenceBefore] = await app.db
      .select({
        amount: recurrences.amount,
        description: recurrences.description,
        version: recurrences.version,
      })
      .from(recurrences)
      .where(eq(recurrences.id, recurrence.id));

    const res = await app.inject({
      method: "PUT",
      url: `/recurrences/${recurrence.id}/edit-scope`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        scope: "single",
        occurrenceDate: "2026-05-04",
        changes: {
          amount: 150,
          description: "Despesa ajustada",
          categoryId: category2.id,
        },
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().scope).toBe("single");

    const [pendingAfter] = await app.db
      .select()
      .from(recurrenceOccurrences)
      .where(eq(recurrenceOccurrences.id, pendingBefore.id));
    expect(pendingAfter.version).toBe(pendingBefore.version + 1);
    expect(pendingAfter.status).toBe("pending_review");
    expect(pendingAfter.reviewPayload).toMatchObject({
      amount: 150,
      description: "Despesa ajustada",
      categoryId: category2.id,
      subcategoryId: null,
    });

    const [recurrenceAfter] = await app.db
      .select({
        amount: recurrences.amount,
        description: recurrences.description,
        version: recurrences.version,
      })
      .from(recurrences)
      .where(eq(recurrences.id, recurrence.id));

    expect(recurrenceAfter).toMatchObject(recurrenceBefore);
  });

  it("bloqueia single em ocorrência projetada e orienta uso de override", async () => {
    const { token, account, category } = await createBaseContext();
    const recurrence = await createTransactionRecurrence({
      token,
      accountId: account.id,
      categoryId: category.id,
      startDate: "2026-05-04",
      dayOfWeek: 1,
    });

    const [recurrenceBefore] = await app.db
      .select({
        amount: recurrences.amount,
        notes: recurrences.notes,
        version: recurrences.version,
      })
      .from(recurrences)
      .where(eq(recurrences.id, recurrence.id));

    const res = await app.inject({
      method: "PUT",
      url: `/recurrences/${recurrence.id}/edit-scope`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        scope: "single",
        occurrenceDate: "2026-05-11",
        changes: {
          amount: 175,
          notes: "Ajuste futuro",
          expectedVersion: recurrence.version,
        },
      },
    });

    expect(res.statusCode).toBe(422);
    const body = res.json();
    expect(body.detail).toContain("projetada");
    expect(body.detail).toContain("occurrences/override");

    const [updatedRecurrence] = await app.db
      .select({
        amount: recurrences.amount,
        notes: recurrences.notes,
        version: recurrences.version,
      })
      .from(recurrences)
      .where(eq(recurrences.id, recurrence.id));

    expect(updatedRecurrence).toMatchObject(recurrenceBefore);
  });

  it("aplica this_and_next criando nova regra e encerrando a anterior na vespera", async () => {
    const { token, account, category } = await createBaseContext();
    const recurrence = await createTransactionRecurrence({
      token,
      accountId: account.id,
      categoryId: category.id,
      amount: 100,
      startDate: "2099-01-10",
      dayOfWeek: 6,
    });

    const res = await app.inject({
      method: "PUT",
      url: `/recurrences/${recurrence.id}/edit-scope`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        scope: "this_and_next",
        occurrenceDate: "2099-02-07",
        changes: {
          amount: 250,
          notes: "Ajuste futuro",
          expectedVersion: recurrence.version,
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.scope).toBe("this_and_next");
    expect(body.previousRecurrence.id).toBe(recurrence.id);
    expect(body.previousRecurrence.endType).toBe("until_date");
    expect(body.previousRecurrence.endDate).toBe("2099-02-06");
    expect(body.newRecurrence.startDate).toBe("2099-02-07");
    expect(body.newRecurrence.amount).toBe(250);
    expect(body.newRecurrence.notes).toBe("Ajuste futuro");
  });

  it("this_and_next subtrai ocorrencias consumidas em by_occurrences", async () => {
    const { token, account, category } = await createBaseContext();
    const recurrence = await createTransactionRecurrence({
      token,
      accountId: account.id,
      categoryId: category.id,
      amount: 100,
      startDate: "2099-01-05",
      dayOfWeek: 1,
      endType: "by_occurrences",
      endOccurrences: 10,
    });

    await insertOccurrenceForRecurrence({
      recurrenceId: recurrence.id,
      occurrenceDate: "2099-01-05",
      status: "materialized",
    });
    await insertOccurrenceForRecurrence({
      recurrenceId: recurrence.id,
      occurrenceDate: "2099-01-12",
      status: "materialized",
    });
    await insertOccurrenceForRecurrence({
      recurrenceId: recurrence.id,
      occurrenceDate: "2099-01-19",
      status: "materialized",
    });
    await insertOccurrenceForRecurrence({
      recurrenceId: recurrence.id,
      occurrenceDate: "2099-01-26",
      status: "pending_review",
    });
    await insertOccurrenceForRecurrence({
      recurrenceId: recurrence.id,
      occurrenceDate: "2099-02-02",
      status: "skipped",
    });

    const res = await app.inject({
      method: "PUT",
      url: `/recurrences/${recurrence.id}/edit-scope`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        scope: "this_and_next",
        occurrenceDate: "2099-02-09",
        changes: {
          amount: 250,
          notes: "Ajuste futuro",
          expectedVersion: recurrence.version,
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.scope).toBe("this_and_next");
    expect(body.previousRecurrence.endType).toBe("until_date");
    expect(body.previousRecurrence.endDate).toBe("2099-02-08");
    expect(body.newRecurrence.startDate).toBe("2099-02-09");
    expect(body.newRecurrence.endType).toBe("by_occurrences");
    expect(body.newRecurrence.endOccurrences).toBe(5);
  });

  it("this_and_next preserva endOccurrences explicitamente fornecido pelo usuario", async () => {
    const { token, account, category } = await createBaseContext();
    const recurrence = await createTransactionRecurrence({
      token,
      accountId: account.id,
      categoryId: category.id,
      amount: 100,
      startDate: "2099-01-05",
      dayOfWeek: 1,
      endType: "by_occurrences",
      endOccurrences: 10,
    });

    await insertOccurrenceForRecurrence({
      recurrenceId: recurrence.id,
      occurrenceDate: "2099-01-05",
      status: "materialized",
    });
    await insertOccurrenceForRecurrence({
      recurrenceId: recurrence.id,
      occurrenceDate: "2099-01-12",
      status: "materialized",
    });
    await insertOccurrenceForRecurrence({
      recurrenceId: recurrence.id,
      occurrenceDate: "2099-01-19",
      status: "materialized",
    });
    await insertOccurrenceForRecurrence({
      recurrenceId: recurrence.id,
      occurrenceDate: "2099-01-26",
      status: "pending_review",
    });
    await insertOccurrenceForRecurrence({
      recurrenceId: recurrence.id,
      occurrenceDate: "2099-02-02",
      status: "skipped",
    });

    const res = await app.inject({
      method: "PUT",
      url: `/recurrences/${recurrence.id}/edit-scope`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        scope: "this_and_next",
        occurrenceDate: "2099-02-09",
        changes: {
          amount: 250,
          endOccurrences: 12,
          expectedVersion: recurrence.version,
        },
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().newRecurrence.endType).toBe("by_occurrences");
    expect(res.json().newRecurrence.endOccurrences).toBe(12);
  });

  it("this_and_next nao subtrai quando endType muda", async () => {
    const { token, account, category } = await createBaseContext();
    const recurrence = await createTransactionRecurrence({
      token,
      accountId: account.id,
      categoryId: category.id,
      amount: 100,
      startDate: "2099-01-05",
      dayOfWeek: 1,
      endType: "by_occurrences",
      endOccurrences: 10,
    });

    await insertOccurrenceForRecurrence({
      recurrenceId: recurrence.id,
      occurrenceDate: "2099-01-05",
      status: "materialized",
    });
    await insertOccurrenceForRecurrence({
      recurrenceId: recurrence.id,
      occurrenceDate: "2099-01-12",
      status: "materialized",
    });
    await insertOccurrenceForRecurrence({
      recurrenceId: recurrence.id,
      occurrenceDate: "2099-01-19",
      status: "materialized",
    });
    await insertOccurrenceForRecurrence({
      recurrenceId: recurrence.id,
      occurrenceDate: "2099-01-26",
      status: "pending_review",
    });
    await insertOccurrenceForRecurrence({
      recurrenceId: recurrence.id,
      occurrenceDate: "2099-02-02",
      status: "skipped",
    });

    const res = await app.inject({
      method: "PUT",
      url: `/recurrences/${recurrence.id}/edit-scope`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        scope: "this_and_next",
        occurrenceDate: "2099-02-09",
        changes: {
          amount: 250,
          endType: "until_date",
          endDate: "2099-04-06",
          expectedVersion: recurrence.version,
        },
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().newRecurrence.endType).toBe("until_date");
    expect(res.json().newRecurrence.endDate).toBe("2099-04-06");
    expect(res.json().newRecurrence.endOccurrences).toBeNull();
  });

  it("this_and_next bloqueia quando nao ha ocorrencias restantes em by_occurrences", async () => {
    const { token, user, account, category } = await createBaseContext();
    const recurrence = await createTransactionRecurrence({
      token,
      accountId: account.id,
      categoryId: category.id,
      amount: 100,
      startDate: "2099-01-05",
      dayOfWeek: 1,
      endType: "by_occurrences",
      endOccurrences: 5,
    });

    await insertOccurrenceForRecurrence({
      recurrenceId: recurrence.id,
      occurrenceDate: "2099-01-05",
      status: "materialized",
    });
    await insertOccurrenceForRecurrence({
      recurrenceId: recurrence.id,
      occurrenceDate: "2099-01-12",
      status: "materialized",
    });
    await insertOccurrenceForRecurrence({
      recurrenceId: recurrence.id,
      occurrenceDate: "2099-01-19",
      status: "materialized",
    });
    await insertOccurrenceForRecurrence({
      recurrenceId: recurrence.id,
      occurrenceDate: "2099-01-26",
      status: "pending_review",
    });
    await insertOccurrenceForRecurrence({
      recurrenceId: recurrence.id,
      occurrenceDate: "2099-02-02",
      status: "skipped",
    });

    const res = await app.inject({
      method: "PUT",
      url: `/recurrences/${recurrence.id}/edit-scope`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        scope: "this_and_next",
        occurrenceDate: "2099-02-09",
        changes: {
          amount: 250,
          expectedVersion: recurrence.version,
        },
      },
    });

    expect(res.statusCode).toBe(422);
    expect(res.json().detail).toContain("ocorrências restantes");

    const savedRecurrences = await app.db
      .select({
        id: recurrences.id,
        endType: recurrences.endType,
        endDate: recurrences.endDate,
        endOccurrences: recurrences.endOccurrences,
      })
      .from(recurrences)
      .where(and(eq(recurrences.userId, user.id), sql`${recurrences.deletedAt} IS NULL`));

    expect(savedRecurrences).toHaveLength(1);
    expect(savedRecurrences[0]).toMatchObject({
      id: recurrence.id,
      endType: "by_occurrences",
      endDate: null,
      endOccurrences: 5,
    });
  });

  it("bloqueia this_and_next em data já materializada mesmo com lastMaterializedDate stale", async () => {
    const { token, account, category } = await createBaseContext();
    const recurrence = await createTransactionRecurrence({
      token,
      accountId: account.id,
      categoryId: category.id,
      amount: 100,
      startDate: "2099-01-06",
      dayOfWeek: 1,
    });

    const materializeRes = await app.inject({
      method: "POST",
      url: "/recurrences/materialize",
      headers: { Authorization: `Bearer ${token}` },
      payload: { untilDate: "2099-01-20" },
    });
    expect(materializeRes.statusCode).toBe(200);
    expect(materializeRes.json().createdOccurrences).toBeGreaterThan(0);

    await app.db
      .update(recurrences)
      .set({ lastMaterializedDate: null, lastMaterializedAt: null })
      .where(eq(recurrences.id, recurrence.id));

    const res = await app.inject({
      method: "PUT",
      url: `/recurrences/${recurrence.id}/edit-scope`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        scope: "this_and_next",
        occurrenceDate: "2099-01-13",
        changes: {
          amount: 250,
        },
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().detail).toContain("ocorrência já materializada");
  });

  it("preserva término por ocorrências em update parcial de descrição", async () => {
    const { token, account, category } = await createBaseContext();
    const recurrence = await createTransactionRecurrence({
      token,
      accountId: account.id,
      categoryId: category.id,
      startDate: "2099-01-06",
      endType: "by_occurrences",
      endOccurrences: 5,
    });

    const res = await app.inject({
      method: "PUT",
      url: `/recurrences/${recurrence.id}`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        description: "Despesa recorrente 1.6",
        expectedVersion: recurrence.version,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().description).toBe("Despesa recorrente 1.6");
    expect(res.json().endType).toBe("by_occurrences");
    expect(res.json().endOccurrences).toBe(5);

    const [saved] = await app.db
      .select({
        endType: recurrences.endType,
        endOccurrences: recurrences.endOccurrences,
      })
      .from(recurrences)
      .where(eq(recurrences.id, recurrence.id));

    expect(saved.endType).toBe("by_occurrences");
    expect(saved.endOccurrences).toBe(5);
  });

  it("altera término por ocorrências para data final em update global", async () => {
    const { token, account, category } = await createBaseContext();
    const recurrence = await createTransactionRecurrence({
      token,
      accountId: account.id,
      categoryId: category.id,
      startDate: "2099-01-06",
      endType: "by_occurrences",
      endOccurrences: 5,
    });

    const res = await app.inject({
      method: "PUT",
      url: `/recurrences/${recurrence.id}`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        postingMode: "automatic",
        frequency: "weekly",
        startDate: "2099-01-06",
        dayOfWeek: 1,
        endType: "until_date",
        endDate: "2099-12-31",
        accountId: account.id,
        categoryId: category.id,
        amount: 120,
        description: "Despesa recorrente",
        expectedVersion: recurrence.version,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().endType).toBe("until_date");
    expect(res.json().endDate).toBe("2099-12-31");
    expect(res.json().endOccurrences).toBeNull();

    const [saved] = await app.db
      .select({
        endType: recurrences.endType,
        endOccurrences: recurrences.endOccurrences,
        endDate: recurrences.endDate,
      })
      .from(recurrences)
      .where(eq(recurrences.id, recurrence.id));

    expect(saved.endType).toBe("until_date");
    expect(saved.endDate).toBe("2099-12-31");
    expect(saved.endOccurrences).toBeNull();
  });

  it("cria recorrência por data final e limita a timeline até a data final", async () => {
    const { token, account, category } = await createBaseContext();
    const recurrence = await createTransactionRecurrence({
      token,
      accountId: account.id,
      categoryId: category.id,
      startDate: "2099-01-05",
      endType: "until_date",
      endDate: "2099-01-19",
    });

    expect(recurrence.endType).toBe("until_date");
    expect(recurrence.endDate).toBe("2099-01-19");
    expect(recurrence.endOccurrences).toBeNull();

    const timelineRes = await app.inject({
      method: "GET",
      url: `/recurrences/${recurrence.id}/timeline?limit=12&includeProjected=true`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(timelineRes.statusCode).toBe(200);
    const body = timelineRes.json();
    expect(body.summary.totalOccurrences).toBe(3);
    expect(body.summary.hasMoreProjected).toBe(false);
    expect(body.pagination.total).toBe(3);
    expect(body.pagination.hasMore).toBe(false);
    expect(
      body.items.map((item: { occurrenceDate: string; sequence: number | null }) => ({
        occurrenceDate: item.occurrenceDate,
        sequence: item.sequence,
      })),
    ).toEqual([
      { occurrenceDate: "2099-01-05", sequence: 1 },
      { occurrenceDate: "2099-01-12", sequence: 2 },
      { occurrenceDate: "2099-01-19", sequence: 3 },
    ]);
  });

  it("limita timeline semanal de recorrência sem fim ao horizonte operacional de 1 ano", async () => {
    const { token, account, category } = await createBaseContext();
    const recurrence = await createTransactionRecurrence({
      token,
      accountId: account.id,
      categoryId: category.id,
      startDate: "2099-01-06",
      dayOfWeek: 1,
      endType: "never",
    });

    const timelineRes = await app.inject({
      method: "GET",
      url: `/recurrences/${recurrence.id}/timeline?limit=120&untilDate=2101-01-01&includeProjected=true`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(timelineRes.statusCode).toBe(200);
    const body = timelineRes.json();
    const items = body.items as Array<{ occurrenceDate: string; sequence: number | null }>;

    expect(items.length).toBeGreaterThan(0);
    expect(items.at(-1)?.occurrenceDate).toBe("2100-01-04");
    expect(items.every((item) => item.occurrenceDate <= "2100-01-06")).toBe(true);
    expect(items.some((item) => item.occurrenceDate > "2100-01-06")).toBe(false);
    expect(items.every((item) => item.sequence === null)).toBe(true);
    expect(body.summary.totalOccurrences).toBeNull();
    expect(body.summary.hasMoreProjected).toBe(false);
    expect(body.pagination.total).toBe(items.length);
    expect(body.pagination.hasMore).toBe(false);
  });

  it("limita materialização de recorrência sem fim ao horizonte operacional de 1 ano", async () => {
    const { token, account, category } = await createBaseContext();
    const recurrenceRes = await app.inject({
      method: "POST",
      url: "/recurrences",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        originType: "transaction",
        postingMode: "automatic",
        frequency: "monthly",
        startDate: "2099-01-10",
        dayOfMonth: 10,
        endType: "never",
        accountId: account.id,
        categoryId: category.id,
        amount: 120,
        description: "Despesa recorrente",
      },
    });
    expect(recurrenceRes.statusCode).toBe(201);
    const recurrence = recurrenceRes.json();

    const materializeRes = await app.inject({
      method: "POST",
      url: "/recurrences/materialize",
      headers: { Authorization: `Bearer ${token}` },
      payload: { untilDate: "2101-01-01" },
    });

    expect(materializeRes.statusCode).toBe(200);
    expect(materializeRes.json().createdOccurrences).toBeGreaterThan(0);
    expect(materializeRes.json().createdOccurrences).toBe(13);
    expect(materializeRes.json().finalizedRecurrences).toBe(1);

    const occurrences = await app.db
      .select({ occurrenceDate: recurrenceOccurrences.occurrenceDate })
      .from(recurrenceOccurrences)
      .where(eq(recurrenceOccurrences.recurrenceId, recurrence.id))
      .orderBy(asc(recurrenceOccurrences.occurrenceDate));

    expect(occurrences.length).toBeGreaterThan(0);
    expect(occurrences.every((occurrence) => occurrence.occurrenceDate <= "2100-01-10")).toBe(true);
    expect(occurrences.some((occurrence) => occurrence.occurrenceDate > "2100-01-10")).toBe(false);

    const [saved] = await app.db
      .select({
        status: recurrences.status,
        nextOccurrenceDate: recurrences.nextOccurrenceDate,
      })
      .from(recurrences)
      .where(eq(recurrences.id, recurrence.id));

    expect(saved.status).toBe("finalized");
    expect(saved.nextOccurrenceDate).toBeNull();
  });

  it("aceita snapshot completo do frontend com observações vazias ao editar descrição", async () => {
    const { token, account, category, subcategory } = await createBaseContext();
    const recurrence = await createTransactionRecurrence({
      token,
      accountId: account.id,
      categoryId: category.id,
      startDate: "2099-01-06",
      endType: "by_occurrences",
      endOccurrences: 5,
    });

    const res = await app.inject({
      method: "PUT",
      url: `/recurrences/${recurrence.id}`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        postingMode: "automatic",
        frequency: "weekly",
        startDate: "2099-01-06",
        dayOfWeek: 1,
        endType: "by_occurrences",
        endOccurrences: 5,
        accountId: account.id,
        categoryId: category.id,
        subcategoryId: subcategory.id,
        amount: 50,
        description: "Despesa recorrente 2.1",
        notes: null,
        expectedVersion: recurrence.version,
      },
    });

    expect(res.statusCode).toBe(200);
  });

  it("retorna 409 em conflito otimista de versao", async () => {
    const { token, account, category } = await createBaseContext();
    const recurrence = await createTransactionRecurrence({
      token,
      accountId: account.id,
      categoryId: category.id,
    });

    const firstUpdate = await app.inject({
      method: "PUT",
      url: `/recurrences/${recurrence.id}`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        amount: 130,
        expectedVersion: recurrence.version,
      },
    });
    expect(firstUpdate.statusCode).toBe(200);

    const staleUpdate = await app.inject({
      method: "PUT",
      url: `/recurrences/${recurrence.id}`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        amount: 140,
        expectedVersion: recurrence.version,
      },
    });

    expect(staleUpdate.statusCode).toBe(409);
    expect(staleUpdate.json().detail).toContain("foi alterada por outra sessão");
  });

  it("bloqueia exclusao de ativa e permite excluir apos finalize", async () => {
    const { token, account, account2 } = await createBaseContext();

    const transferRecurrenceRes = await app.inject({
      method: "POST",
      url: "/recurrences",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        originType: "transfer",
        frequency: "monthly",
        startDate: "2099-01-15",
        dayOfMonth: 15,
        endType: "never",
        fromAccountId: account.id,
        toAccountId: account2.id,
        amount: 400,
        description: "Reserva",
      },
    });
    expect(transferRecurrenceRes.statusCode).toBe(201);
    const transferRecurrence = transferRecurrenceRes.json();

    const blockedDelete = await app.inject({
      method: "DELETE",
      url: `/recurrences/${transferRecurrence.id}`,
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(blockedDelete.statusCode).toBe(400);
    expect(blockedDelete.json().detail).toContain("Finalize antes de excluir");

    const finalized = await app.inject({
      method: "PUT",
      url: `/recurrences/${transferRecurrence.id}/finalize`,
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(finalized.statusCode).toBe(200);
    expect(finalized.json().status).toBe("finalized");

    const deleted = await app.inject({
      method: "DELETE",
      url: `/recurrences/${transferRecurrence.id}`,
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(deleted.statusCode).toBe(200);
    expect(deleted.json().message).toContain("removida com sucesso");

    const getDeleted = await app.inject({
      method: "GET",
      url: `/recurrences/${transferRecurrence.id}`,
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(getDeleted.statusCode).toBe(404);
  });

  it("bloqueia finalize e exclusao quando ha pendencia aberta", async () => {
    const { token, account, category } = await createBaseContext();

    const recurrenceRes = await app.inject({
      method: "POST",
      url: "/recurrences",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        originType: "transaction",
        postingMode: "review_required",
        frequency: "monthly",
        startDate: "2099-01-10",
        dayOfMonth: 10,
        endType: "never",
        accountId: account.id,
        categoryId: category.id,
        amount: 150,
        description: "Pendente em aberto",
      },
    });
    expect(recurrenceRes.statusCode).toBe(201);
    const recurrence = recurrenceRes.json();

    const materializeRes = await app.inject({
      method: "POST",
      url: "/recurrences/materialize",
      headers: { Authorization: `Bearer ${token}` },
      payload: { untilDate: "2099-01-31" },
    });
    expect(materializeRes.statusCode).toBe(200);
    expect(materializeRes.json().createdOccurrences).toBe(1);

    const [pendingOccurrence] = await app.db
      .select()
      .from(recurrenceOccurrences)
      .where(
        and(
          eq(recurrenceOccurrences.recurrenceId, recurrence.id),
          eq(recurrenceOccurrences.status, "pending_review"),
        ),
      )
      .limit(1);

    expect(pendingOccurrence).toBeDefined();

    const finalizeBlocked = await app.inject({
      method: "PUT",
      url: `/recurrences/${recurrence.id}/finalize`,
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(finalizeBlocked.statusCode).toBe(422);
    expect(finalizeBlocked.json().detail).toContain(pendingOccurrence.id);
    expect(finalizeBlocked.json().detail).toContain("finalizar");

    const deleteBlocked = await app.inject({
      method: "DELETE",
      url: `/recurrences/${recurrence.id}`,
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(deleteBlocked.statusCode).toBe(422);
    expect(deleteBlocked.json().detail).toContain(pendingOccurrence.id);
    expect(deleteBlocked.json().detail).toContain("excluir");

    const [afterBlockedActions] = await app.db
      .select({
        status: recurrences.status,
        finalizedAt: recurrences.finalizedAt,
        deletedAt: recurrences.deletedAt,
      })
      .from(recurrences)
      .where(eq(recurrences.id, recurrence.id));

    expect(afterBlockedActions?.status).toBe("active");
    expect(afterBlockedActions?.finalizedAt).toBeNull();
    expect(afterBlockedActions?.deletedAt).toBeNull();
  });

  it("bloqueia review_required para automatic quando ha pendencia aberta", async () => {
    const { token, account, category } = await createBaseContext();

    const recurrenceRes = await app.inject({
      method: "POST",
      url: "/recurrences",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        originType: "transaction",
        postingMode: "review_required",
        frequency: "weekly",
        startDate: "2025-01-06",
        dayOfWeek: 1,
        accountId: account.id,
        categoryId: category.id,
        amount: 75,
        description: "Modo de revisão",
      },
    });
    expect(recurrenceRes.statusCode).toBe(201);
    const recurrence = recurrenceRes.json();

    const materializeRes = await app.inject({
      method: "POST",
      url: "/recurrences/materialize",
      headers: { Authorization: `Bearer ${token}` },
      payload: { untilDate: "2025-01-20" },
    });
    expect(materializeRes.statusCode).toBe(200);

    const [pendingOccurrence] = await app.db
      .select()
      .from(recurrenceOccurrences)
      .where(
        and(
          eq(recurrenceOccurrences.recurrenceId, recurrence.id),
          eq(recurrenceOccurrences.status, "pending_review"),
        ),
      )
      .limit(1);
    expect(pendingOccurrence).toBeDefined();

    const [currentRecurrence] = await app.db
      .select({ version: recurrences.version })
      .from(recurrences)
      .where(eq(recurrences.id, recurrence.id))
      .limit(1);

    const updateRes = await app.inject({
      method: "PUT",
      url: `/recurrences/${recurrence.id}`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        postingMode: "automatic",
        expectedVersion: currentRecurrence.version,
      },
    });

    expect(updateRes.statusCode).toBe(422);
    expect(updateRes.json().detail).toContain(pendingOccurrence.id);
    expect(updateRes.json().detail).toContain("modo de lançamento");
  });

  it("altera postingMode em recorrencia ativa nos dois sentidos sem pendencias abertas", async () => {
    const { token, account, category } = await createBaseContext();

    const recurrenceRes = await app.inject({
      method: "POST",
      url: "/recurrences",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        originType: "transaction",
        postingMode: "automatic",
        frequency: "weekly",
        startDate: "2025-01-06",
        dayOfWeek: 1,
        accountId: account.id,
        categoryId: category.id,
        amount: 75,
        description: "Troca de modo",
      },
    });
    expect(recurrenceRes.statusCode).toBe(201);
    const recurrence = recurrenceRes.json();

    const toReviewRes = await app.inject({
      method: "PUT",
      url: `/recurrences/${recurrence.id}`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        postingMode: "review_required",
        expectedVersion: recurrence.version,
      },
    });

    expect(toReviewRes.statusCode).toBe(200);
    const reviewed = toReviewRes.json();
    expect(reviewed.postingMode).toBe("review_required");
    expect(reviewed.version).toBe(recurrence.version + 1);

    const backToAutomaticRes = await app.inject({
      method: "PUT",
      url: `/recurrences/${reviewed.id}`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        postingMode: "automatic",
        expectedVersion: reviewed.version,
      },
    });

    expect(backToAutomaticRes.statusCode).toBe(200);
    const reverted = backToAutomaticRes.json();
    expect(reverted.postingMode).toBe("automatic");
    expect(reverted.version).toBe(reviewed.version + 1);
  });

  it("bloqueia campos de transferência em create de recorrência de transação", async () => {
    const { token, account, account2, category } = await createBaseContext();

    const res = await app.inject({
      method: "POST",
      url: "/recurrences",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        originType: "transaction",
        frequency: "monthly",
        startDate: "2099-01-10",
        dayOfMonth: 10,
        endType: "never",
        accountId: account.id,
        categoryId: category.id,
        fromAccountId: account.id,
        toAccountId: account2.id,
        amount: 100,
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().detail).toContain("não aceita contas de transferência");
  });

  it("reseta subcategoria ao trocar categoria sem enviar nova subcategoria", async () => {
    const { token, account, category, category2, subcategory } = await createBaseContext();

    const created = await app.inject({
      method: "POST",
      url: "/recurrences",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        originType: "transaction",
        frequency: "monthly",
        startDate: "2099-01-10",
        dayOfMonth: 10,
        endType: "never",
        accountId: account.id,
        categoryId: category.id,
        subcategoryId: subcategory.id,
        amount: 120,
      },
    });
    expect(created.statusCode).toBe(201);

    const recurrence = created.json();
    const updated = await app.inject({
      method: "PUT",
      url: `/recurrences/${recurrence.id}`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        categoryId: category2.id,
        expectedVersion: recurrence.version,
      },
    });

    expect(updated.statusCode).toBe(200);
    expect(updated.json().categoryId).toBe(category2.id);
    expect(updated.json().subcategoryId).toBeNull();
  });

  it("bloqueia filtro por conta que não pertence ao usuário em listagem", async () => {
    const owner = await createBaseContext();
    const outsider = await createBaseContext();

    await createTransactionRecurrence({
      token: owner.token,
      accountId: owner.account.id,
      categoryId: owner.category.id,
      startDate: "2099-01-06",
      dayOfWeek: 1,
    });

    const res = await app.inject({
      method: "GET",
      url: `/recurrences?accountId=${outsider.account.id}`,
      headers: { Authorization: `Bearer ${owner.token}` },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().detail).toContain("Acesso negado à conta");
  });

  it("marca recorrência como falha quando vínculo de conta não pertence ao usuário na materialização", async () => {
    const owner = await createBaseContext();
    const outsider = await createBaseContext();

    const recurrence = await createTransactionRecurrence({
      token: owner.token,
      accountId: owner.account.id,
      categoryId: owner.category.id,
      startDate: "2099-01-06",
      dayOfWeek: 1,
    });

    await app.db
      .update(recurrences)
      .set({ accountId: outsider.account.id })
      .where(eq(recurrences.id, recurrence.id));

    const materializeRes = await app.inject({
      method: "POST",
      url: "/recurrences/materialize",
      headers: { Authorization: `Bearer ${owner.token}` },
      payload: { untilDate: "2099-01-20" },
    });

    expect(materializeRes.statusCode).toBe(200);
    expect(materializeRes.json().failedRecurrences).toBeGreaterThanOrEqual(1);
    expect(materializeRes.json().createdOccurrences).toBe(0);
  });

  it("garante rollback integral ao falhar metade da materialização de transferência", async () => {
    const { token, account, account2 } = await createBaseContext();
    const rollbackMarker = `Transfer rollback ${crypto.randomUUID()}`;
    const suffix = crypto.randomUUID().replace(/-/g, "");
    const fnName = `fail_income_transfer_rollback_${suffix}`;
    const triggerName = `trg_fail_income_transfer_rollback_${suffix}`;

    const transferRecurrenceRes = await app.inject({
      method: "POST",
      url: "/recurrences",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        originType: "transfer",
        frequency: "monthly",
        startDate: "2099-01-15",
        dayOfMonth: 15,
        endType: "never",
        fromAccountId: account.id,
        toAccountId: account2.id,
        amount: 400,
        description: rollbackMarker,
      },
    });
    expect(transferRecurrenceRes.statusCode).toBe(201);
    const transferRecurrence = transferRecurrenceRes.json();

    try {
      await app.db.execute(
        sql.raw(`
          create function ${fnName}()
          returns trigger
          language plpgsql
          as $$
          begin
            if NEW.description = '${rollbackMarker}' and NEW.type = 'income' then
              raise exception 'forced rollback on income leg';
            end if;
            return NEW;
          end;
          $$;
        `),
      );
      await app.db.execute(
        sql.raw(`
          create trigger ${triggerName}
          before insert on transactions
          for each row
          execute function ${fnName}();
        `),
      );

      const materializeRes = await app.inject({
        method: "POST",
        url: "/recurrences/materialize",
        headers: { Authorization: `Bearer ${token}` },
        payload: { untilDate: "2099-01-20" },
      });
      expect(materializeRes.statusCode).toBe(200);
      expect(materializeRes.json().failedRecurrences).toBeGreaterThanOrEqual(1);
      expect(materializeRes.json().createdTransfers).toBe(0);
      expect(materializeRes.json().createdOccurrences).toBe(0);

      const persistedOccurrences = await app.db
        .select({ id: recurrenceOccurrences.id })
        .from(recurrenceOccurrences)
        .where(eq(recurrenceOccurrences.recurrenceId, transferRecurrence.id));
      expect(persistedOccurrences.length).toBe(0);

      const persistedTransferTxs = await app.db
        .select({ id: transactions.id })
        .from(transactions)
        .where(eq(transactions.description, rollbackMarker));
      expect(persistedTransferTxs.length).toBe(0);
    } finally {
      await app.db.execute(
        sql.raw(`
          drop trigger if exists ${triggerName} on transactions;
          drop function if exists ${fnName}();
        `),
      );
    }
  });

  it("override cria sobrescrita e a timeline mescla valor da ocorrencia projetada", async () => {
    const { token, account, category } = await createBaseContext();
    const recurrence = await createTransactionRecurrence({
      token,
      accountId: account.id,
      categoryId: category.id,
      startDate: "2030-01-07",
      dayOfWeek: 1,
      endType: "by_occurrences",
      endOccurrences: 3,
    });

    const overrideRes = await app.inject({
      method: "PUT",
      url: `/recurrences/${recurrence.id}/occurrences/override`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        occurrenceDate: "2030-01-14",
        amount: 250,
        description: "Despesa com override",
        notes: "observacao pontual",
      },
    });

    expect(overrideRes.statusCode).toBe(200);
    expect(overrideRes.json()).toMatchObject({
      recurrenceId: recurrence.id,
      occurrenceDate: "2030-01-14",
      amount: 250,
      description: "Despesa com override",
      notes: "observacao pontual",
    });

    const timelineRes = await app.inject({
      method: "GET",
      url: `/recurrences/${recurrence.id}/timeline?untilDate=2030-01-21&limit=3`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(timelineRes.statusCode).toBe(200);
    const overrideItem = timelineRes
      .json()
      .items.find((item: { occurrenceDate: string }) => item.occurrenceDate === "2030-01-14");
    expect(overrideItem).toMatchObject({
      occurrenceDate: "2030-01-14",
      status: "projected",
      source: "projected",
      amount: 250,
      hasOverride: true,
    });
  });

  it("override materializacao consome a sobrescrita e remove o registro", async () => {
    const { token, account, category } = await createBaseContext();
    const recurrence = await createTransactionRecurrence({
      token,
      accountId: account.id,
      categoryId: category.id,
      startDate: "2030-01-07",
      dayOfWeek: 1,
      endType: "by_occurrences",
      endOccurrences: 2,
    });

    const overrideRes = await app.inject({
      method: "PUT",
      url: `/recurrences/${recurrence.id}/occurrences/override`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        occurrenceDate: "2030-01-14",
        amount: 333,
        description: "Override materializado",
        notes: "nota do override",
      },
    });
    expect(overrideRes.statusCode).toBe(200);

    const materializeRes = await app.inject({
      method: "POST",
      url: "/recurrences/materialize",
      headers: { Authorization: `Bearer ${token}` },
      payload: { recurrenceId: recurrence.id, untilDate: "2030-01-14" },
    });

    expect(materializeRes.statusCode).toBe(200);
    expect(materializeRes.json().createdTransactions).toBe(2);

    const [createdTx] = await app.db
      .select({
        amount: transactions.amount,
        description: transactions.description,
        notes: transactions.notes,
      })
      .from(transactions)
      .where(and(eq(transactions.userId, recurrence.userId), eq(transactions.date, "2030-01-14")));

    expect(Number(createdTx?.amount)).toBe(333);
    expect(createdTx?.description).toBe("Override materializado");
    expect(createdTx?.notes).toBe("nota do override");

    const remainingOverrides = await app.db
      .select({ id: recurrenceOccurrenceOverrides.id })
      .from(recurrenceOccurrenceOverrides)
      .where(eq(recurrenceOccurrenceOverrides.recurrenceId, recurrence.id));
    expect(remainingOverrides).toHaveLength(0);
  });

  it("override this_and_next migra sobrescritas futuras para a nova recorrencia", async () => {
    const { token, account, category } = await createBaseContext();
    const recurrence = await createTransactionRecurrence({
      token,
      accountId: account.id,
      categoryId: category.id,
      startDate: "2030-01-07",
      dayOfWeek: 1,
      endType: "by_occurrences",
      endOccurrences: 5,
    });

    const overrideRes = await app.inject({
      method: "PUT",
      url: `/recurrences/${recurrence.id}/occurrences/override`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { occurrenceDate: "2030-01-21", amount: 444 },
    });
    expect(overrideRes.statusCode).toBe(200);

    const editRes = await app.inject({
      method: "PUT",
      url: `/recurrences/${recurrence.id}/edit-scope`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        scope: "this_and_next",
        occurrenceDate: "2030-01-14",
        changes: { amount: 180, expectedVersion: recurrence.version },
      },
    });

    expect(editRes.statusCode).toBe(200);
    const newRecurrenceId = editRes.json().newRecurrence.id;

    const migratedOverrides = await app.db
      .select({
        recurrenceId: recurrenceOccurrenceOverrides.recurrenceId,
        occurrenceDate: recurrenceOccurrenceOverrides.occurrenceDate,
        amount: recurrenceOccurrenceOverrides.amount,
      })
      .from(recurrenceOccurrenceOverrides)
      .where(eq(recurrenceOccurrenceOverrides.occurrenceDate, "2030-01-21"));

    expect(migratedOverrides).toHaveLength(1);
    expect(migratedOverrides[0]).toMatchObject({
      recurrenceId: newRecurrenceId,
      occurrenceDate: "2030-01-21",
    });
    expect(Number(migratedOverrides[0]?.amount)).toBe(444);
  });

  it("override skip remove sobrescrita da mesma data da pendencia", async () => {
    const { token, account, category, user } = await createBaseContext();
    const recurrence = await createTransactionRecurrence({
      token,
      accountId: account.id,
      categoryId: category.id,
      postingMode: "review_required",
      startDate: "2030-01-07",
      dayOfWeek: 1,
      endType: "by_occurrences",
      endOccurrences: 1,
    });

    const materializeRes = await app.inject({
      method: "POST",
      url: "/recurrences/materialize",
      headers: { Authorization: `Bearer ${token}` },
      payload: { recurrenceId: recurrence.id, untilDate: "2030-01-07" },
    });
    expect(materializeRes.statusCode).toBe(200);

    const [pending] = await app.db
      .select()
      .from(recurrenceOccurrences)
      .where(eq(recurrenceOccurrences.recurrenceId, recurrence.id));
    expect(pending?.status).toBe("pending_review");

    await app.db.insert(recurrenceOccurrenceOverrides).values({
      recurrenceId: recurrence.id,
      userId: user.id,
      occurrenceDate: "2030-01-07",
      amount: "555",
    });

    const skipRes = await app.inject({
      method: "POST",
      url: `/recurrences/occurrences/${pending.id}/skip`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { expectedVersion: pending.version },
    });

    expect(skipRes.statusCode).toBe(200);

    const remainingOverrides = await app.db
      .select({ id: recurrenceOccurrenceOverrides.id })
      .from(recurrenceOccurrenceOverrides)
      .where(eq(recurrenceOccurrenceOverrides.recurrenceId, recurrence.id));
    expect(remainingOverrides).toHaveLength(0);
  });

  it("permite edição de estrutura antes de qualquer ocorrência consumida", async () => {
    const { token, account, category } = await createBaseContext();
    const recurrence = await createTransactionRecurrence({
      token,
      accountId: account.id,
      categoryId: category.id,
      startDate: "2030-01-07",
      dayOfWeek: 1,
    });

    const updateRes = await app.inject({
      method: "PUT",
      url: `/recurrences/${recurrence.id}`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        startDate: "2030-01-14",
        frequency: "monthly",
        dayOfMonth: 14,
        endType: "until_date",
        endDate: "2030-12-14",
        expectedVersion: recurrence.version,
      },
    });

    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.json()).toMatchObject({
      hasConsumedOccurrences: false,
      startDate: "2030-01-14",
      frequency: "monthly",
      dayOfMonth: 14,
      endType: "until_date",
      endDate: "2030-12-14",
    });
  });

  it("bloqueia edição de estrutura consumida após ocorrência materialized", async () => {
    const { token, account, category } = await createBaseContext();
    const recurrence = await createTransactionRecurrence({
      token,
      accountId: account.id,
      categoryId: category.id,
      startDate: "2030-01-07",
      dayOfWeek: 1,
    });

    await insertOccurrenceForRecurrence({
      recurrenceId: recurrence.id,
      occurrenceDate: "2030-01-07",
      status: "materialized",
    });

    const updateRes = await app.inject({
      method: "PUT",
      url: `/recurrences/${recurrence.id}`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        startDate: "2030-01-14",
        frequency: "monthly",
        dayOfMonth: 14,
        endType: "by_occurrences",
        endOccurrences: 8,
        expectedVersion: recurrence.version,
      },
    });

    expect(updateRes.statusCode).toBe(422);
    expect(updateRes.json().detail).toContain("Edite apenas descrição/observações");
  });

  it("bloqueia edição de estrutura consumida em conta/categoria/subcategoria", async () => {
    const { token, account, account2, category, category2, subcategory } =
      await createBaseContext();
    const recurrence = await createTransactionRecurrence({
      token,
      accountId: account.id,
      categoryId: category.id,
      startDate: "2030-01-07",
      dayOfWeek: 1,
    });

    await insertOccurrenceForRecurrence({
      recurrenceId: recurrence.id,
      occurrenceDate: "2030-01-07",
      status: "materialized",
    });

    const updateRes = await app.inject({
      method: "PUT",
      url: `/recurrences/${recurrence.id}`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        accountId: account2.id,
        categoryId: category2.id,
        subcategoryId: subcategory.id,
        expectedVersion: recurrence.version,
      },
    });

    expect(updateRes.statusCode).toBe(422);
    expect(updateRes.json().detail).toContain("Esta e próximas");
  });

  it("bloqueia amount em edição global consumida inclusive via scope all", async () => {
    const { token, account, category } = await createBaseContext();
    const recurrence = await createTransactionRecurrence({
      token,
      accountId: account.id,
      categoryId: category.id,
      startDate: "2030-01-07",
      dayOfWeek: 1,
    });

    await insertOccurrenceForRecurrence({
      recurrenceId: recurrence.id,
      occurrenceDate: "2030-01-07",
      status: "materialized",
    });

    const updateRes = await app.inject({
      method: "PUT",
      url: `/recurrences/${recurrence.id}/edit-scope`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        scope: "all",
        changes: {
          amount: 999,
          expectedVersion: recurrence.version,
        },
      },
    });

    expect(updateRes.statusCode).toBe(422);
    expect(updateRes.json().detail).toContain("ocorrências geradas");
  });

  it("permite description e notes em edição global consumida", async () => {
    const { token, account, category } = await createBaseContext();
    const recurrence = await createTransactionRecurrence({
      token,
      accountId: account.id,
      categoryId: category.id,
      startDate: "2030-01-07",
      dayOfWeek: 1,
    });

    await insertOccurrenceForRecurrence({
      recurrenceId: recurrence.id,
      occurrenceDate: "2030-01-07",
      status: "materialized",
    });

    const updateRes = await app.inject({
      method: "PUT",
      url: `/recurrences/${recurrence.id}`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        description: "Academia ajustada",
        notes: "Somente texto livre",
        expectedVersion: recurrence.version,
      },
    });

    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.json()).toMatchObject({
      description: "Academia ajustada",
      notes: "Somente texto livre",
      hasConsumedOccurrences: true,
    });
  });

  it.each([["pending_review" as const], ["skipped" as const], ["failed" as const]])(
    "bloqueia estrutura consumida quando já existe ocorrência %s",
    async (status) => {
      const { token, account, category } = await createBaseContext();
      const recurrence = await createTransactionRecurrence({
        token,
        accountId: account.id,
        categoryId: category.id,
        startDate: "2030-01-07",
        dayOfWeek: 1,
      });

      await insertOccurrenceForRecurrence({
        recurrenceId: recurrence.id,
        occurrenceDate: "2030-01-07",
        status,
      });

      const updateRes = await app.inject({
        method: "PUT",
        url: `/recurrences/${recurrence.id}`,
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          frequency: "monthly",
          dayOfMonth: 10,
          expectedVersion: recurrence.version,
        },
      });

      expect(updateRes.statusCode).toBe(422);
      expect(updateRes.json().detail).toContain("Edite apenas descrição/observações");
    },
  );

  it("mantém this_and_next permitido para mudança futura não consumida", async () => {
    const { token, account, category } = await createBaseContext();
    const recurrence = await createTransactionRecurrence({
      token,
      accountId: account.id,
      categoryId: category.id,
      startDate: "2030-01-07",
      dayOfWeek: 1,
      endType: "by_occurrences",
      endOccurrences: 8,
    });

    await insertOccurrenceForRecurrence({
      recurrenceId: recurrence.id,
      occurrenceDate: "2030-01-07",
      status: "materialized",
    });

    const editRes = await app.inject({
      method: "PUT",
      url: `/recurrences/${recurrence.id}/edit-scope`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        scope: "this_and_next",
        occurrenceDate: "2030-01-21",
        changes: {
          amount: 180,
          frequency: "monthly",
          dayOfMonth: 21,
          expectedVersion: recurrence.version,
        },
      },
    });

    expect(editRes.statusCode).toBe(200);
    expect(editRes.json().scope).toBe("this_and_next");
    expect(editRes.json().newRecurrence).toMatchObject({
      startDate: "2030-01-21",
      frequency: "monthly",
      dayOfMonth: 21,
      amount: 180,
    });
  });
});
