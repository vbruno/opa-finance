import { and, asc, eq, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { registerAndLogin } from "../helpers/auth";
import { resetTables } from "../helpers/resetTables";
import { buildTestApp } from "../setup";
import { categories, recurrenceOccurrences, recurrences, transactions } from "@/db/schema";

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
    const { token } = await registerAndLogin(app, app.db, email);

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

    return { token, account, account2, category, category2, subcategory };
  }

  async function createTransactionRecurrence({
    token,
    accountId,
    categoryId,
    amount = 120,
    startDate = "2025-01-06",
    dayOfWeek = 1,
    postingMode = "automatic",
    endType = "never",
    endOccurrences,
  }: {
    token: string;
    accountId: string;
    categoryId: string;
    amount?: number;
    startDate?: string;
    dayOfWeek?: number;
    postingMode?: "automatic" | "review_required";
    endType?: "never" | "by_occurrences";
    endOccurrences?: number;
  }) {
    const res = await app.inject({
      method: "POST",
      url: "/recurrences",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        originType: "transaction",
        postingMode,
        frequency: "weekly",
        startDate,
        dayOfWeek,
        endType,
        endOccurrences,
        accountId,
        categoryId,
        amount,
        description: "Despesa recorrente",
      },
    });

    expect(res.statusCode).toBe(201);
    return res.json();
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

  it("materializa recorrência automatic sem regressão", async () => {
    const { token, account, category } = await createBaseContext();
    const recurrence = await createTransactionRecurrence({
      token,
      accountId: account.id,
      categoryId: category.id,
      postingMode: "automatic",
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

    expect(updatedRecurrence?.nextOccurrenceDate).toBe("2025-01-20");
    expect(updatedRecurrence?.lastMaterializedDate).toBe("2025-01-13");
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

    const materializeRes = await app.inject({
      method: "POST",
      url: "/recurrences/materialize",
      headers: { Authorization: `Bearer ${token}` },
      payload: { untilDate: "2025-02-10" },
    });

    expect(materializeRes.statusCode).toBe(200);
    expect(materializeRes.json().createdOccurrences).toBe(3);
    expect(materializeRes.json().createdTransactions).toBe(0);
    // Recorrência permanece ativa enquanto houver pendências em aberto (RCREV-DEF-16):
    // a finalização automática só ocorre depois que todas forem confirmadas/ignoradas.
    expect(materializeRes.json().finalizedRecurrences).toBe(0);

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
      appliedLimit: 24,
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
      startDate: "2025-01-06",
      dayOfWeek: 1,
      endType: "by_occurrences",
      endOccurrences: 4,
    });

    const materializeRes = await app.inject({
      method: "POST",
      url: "/recurrences/materialize",
      headers: { Authorization: `Bearer ${token}` },
      payload: { untilDate: "2025-01-13" },
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
      appliedLimit: 24,
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
      appliedLimit: 24,
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

  it("atualiza a regra-mae em single futuro sem pendencia", async () => {
    const { token, account, category } = await createBaseContext();
    const recurrence = await createTransactionRecurrence({
      token,
      accountId: account.id,
      categoryId: category.id,
      startDate: "2026-05-04",
      dayOfWeek: 1,
    });

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

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.scope).toBe("single");

    const [updatedRecurrence] = await app.db
      .select({
        amount: recurrences.amount,
        notes: recurrences.notes,
        version: recurrences.version,
      })
      .from(recurrences)
      .where(eq(recurrences.id, recurrence.id));

    expect(Number(updatedRecurrence.amount)).toBe(175);
    expect(updatedRecurrence.notes).toBe("Ajuste futuro");
    expect(updatedRecurrence.version).toBe(recurrence.version + 1);
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
});
