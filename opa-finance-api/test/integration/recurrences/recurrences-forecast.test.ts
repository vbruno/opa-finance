import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { registerAndLogin } from "../helpers/auth";
import { resetTables } from "../helpers/resetTables";
import { buildTestApp } from "../setup";

describe("GET /recurrences/forecast", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    const built = await buildTestApp();
    app = built.app;
    await resetTables(built.db);
  });

  afterEach(async () => {
    await app.close();
  });

  async function createBaseContext() {
    const email = `user_${crypto.randomUUID()}@test.com`;
    const { token } = await registerAndLogin(app, app.db, email);

    const account1Res = await app.inject({
      method: "POST",
      url: "/accounts",
      headers: { Authorization: `Bearer ${token}` },
      payload: { name: "Conta Principal", type: "cash" },
    });
    expect(account1Res.statusCode).toBe(201);
    const account1 = account1Res.json();

    const account2Res = await app.inject({
      method: "POST",
      url: "/accounts",
      headers: { Authorization: `Bearer ${token}` },
      payload: { name: "Conta Reserva", type: "cash" },
    });
    expect(account2Res.statusCode).toBe(201);
    const account2 = account2Res.json();

    const categoryRes = await app.inject({
      method: "POST",
      url: "/categories",
      headers: { Authorization: `Bearer ${token}` },
      payload: { name: "Casa", type: "expense" },
    });
    expect(categoryRes.statusCode).toBe(201);
    const category = categoryRes.json();

    return { token, account1, account2, category };
  }

  it("retorna totais reais e projetados até o fim do ano", async () => {
    const { token, account1, account2, category } = await createBaseContext();

    const realTx = await app.inject({
      method: "POST",
      url: "/transactions",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        accountId: account1.id,
        categoryId: category.id,
        type: "expense",
        amount: 40,
        date: "2099-01-02",
        description: "Despesa real",
      },
    });
    expect(realTx.statusCode).toBe(201);

    const txRecurrence = await app.inject({
      method: "POST",
      url: "/recurrences",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        originType: "transaction",
        frequency: "monthly",
        startDate: "2099-01-10",
        dayOfMonth: 10,
        endType: "never",
        accountId: account1.id,
        categoryId: category.id,
        amount: 100,
      },
    });
    expect(txRecurrence.statusCode).toBe(201);

    const transferRecurrence = await app.inject({
      method: "POST",
      url: "/recurrences",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        originType: "transfer",
        frequency: "monthly",
        startDate: "2099-01-15",
        dayOfMonth: 15,
        endType: "never",
        fromAccountId: account1.id,
        toAccountId: account2.id,
        amount: 50,
      },
    });
    expect(transferRecurrence.statusCode).toBe(201);

    const res = await app.inject({
      method: "GET",
      url: "/recurrences/forecast?year=2099",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.year).toBe(2099);
    expect(body.timezone).toBe("Australia/Adelaide");
    expect(body.horizon.projectionStartDate).toBe("2099-01-01");
    expect(body.horizon.projectionEndDate).toBe("2099-12-31");

    expect(body.totals.real.income.yearTotal).toBe(0);
    expect(body.totals.real.expense.yearTotal).toBe(40);
    expect(body.totals.real.balance.yearTotal).toBe(-40);

    expect(body.totals.projected.income.yearTotal).toBe(600);
    expect(body.totals.projected.expense.yearTotal).toBe(1800);
    expect(body.totals.projected.balance.yearTotal).toBe(-1200);

    expect(body.totals.combined.income.yearTotal).toBe(600);
    expect(body.totals.combined.expense.yearTotal).toBe(1840);
    expect(body.totals.combined.balance.yearTotal).toBe(-1240);

    expect(body.totals.real.expense.months[0]).toBe(40);
    expect(body.totals.projected.income.months[0]).toBe(50);
    expect(body.totals.projected.expense.months[0]).toBe(150);
  });

  it("aplica filtro por conta nas pernas de transferência", async () => {
    const { token, account1, account2, category } = await createBaseContext();

    const txRecurrence = await app.inject({
      method: "POST",
      url: "/recurrences",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        originType: "transaction",
        frequency: "monthly",
        startDate: "2099-01-10",
        dayOfMonth: 10,
        endType: "never",
        accountId: account1.id,
        categoryId: category.id,
        amount: 100,
      },
    });
    expect(txRecurrence.statusCode).toBe(201);

    const transferRecurrence = await app.inject({
      method: "POST",
      url: "/recurrences",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        originType: "transfer",
        frequency: "monthly",
        startDate: "2099-01-15",
        dayOfMonth: 15,
        endType: "never",
        fromAccountId: account1.id,
        toAccountId: account2.id,
        amount: 50,
      },
    });
    expect(transferRecurrence.statusCode).toBe(201);

    const res = await app.inject({
      method: "GET",
      url: `/recurrences/forecast?year=2099&accountIds=${account1.id}`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.totals.projected.income.yearTotal).toBe(0);
    expect(body.totals.projected.expense.yearTotal).toBe(1800);
    expect(body.totals.projected.balance.yearTotal).toBe(-1800);
  });

  it("não projeta para ano passado (somente real, projectionStartDate nulo)", async () => {
    const { token, account1, category } = await createBaseContext();

    const realTx = await app.inject({
      method: "POST",
      url: "/transactions",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        accountId: account1.id,
        categoryId: category.id,
        type: "expense",
        amount: 77,
        date: "2025-03-10",
        description: "Despesa histórica",
      },
    });
    expect(realTx.statusCode).toBe(201);

    const recurrence = await app.inject({
      method: "POST",
      url: "/recurrences",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        originType: "transaction",
        frequency: "monthly",
        startDate: "2025-01-10",
        dayOfMonth: 10,
        endType: "never",
        accountId: account1.id,
        categoryId: category.id,
        amount: 99,
      },
    });
    expect(recurrence.statusCode).toBe(201);

    const res = await app.inject({
      method: "GET",
      url: "/recurrences/forecast?year=2025",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.horizon.projectionStartDate).toBe(null);
    expect(body.totals.real.expense.yearTotal).toBe(77);
    expect(body.totals.projected.income.yearTotal).toBe(0);
    expect(body.totals.projected.expense.yearTotal).toBe(0);
    expect(body.totals.projected.balance.yearTotal).toBe(0);
  });

  it("respeita limite by_occurrences já consumido e não projeta novas ocorrências", async () => {
    const { token, account1, category } = await createBaseContext();

    const recurrenceRes = await app.inject({
      method: "POST",
      url: "/recurrences",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        originType: "transaction",
        frequency: "monthly",
        startDate: "2099-01-10",
        dayOfMonth: 10,
        postingMode: "review_required",
        endType: "by_occurrences",
        endOccurrences: 2,
        accountId: account1.id,
        categoryId: category.id,
        amount: 100,
      },
    });
    expect(recurrenceRes.statusCode).toBe(201);

    const materialize = await app.inject({
      method: "POST",
      url: "/recurrences/materialize",
      headers: { Authorization: `Bearer ${token}` },
      payload: { untilDate: "2099-02-28" },
    });
    expect(materialize.statusCode).toBe(200);
    expect(materialize.json().createdOccurrences).toBe(2);
    expect(materialize.json().createdTransactions).toBe(0);

    const res = await app.inject({
      method: "GET",
      url: "/recurrences/forecast?year=2099",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.metadata.projectedOccurrences).toBe(0);
    expect(body.totals.projected.income.yearTotal).toBe(0);
    expect(body.totals.projected.expense.yearTotal).toBe(0);
  });

  it("retorna 403 ao filtrar com conta que não pertence ao usuário", async () => {
    const userA = await createBaseContext();
    const userB = await createBaseContext();

    const res = await app.inject({
      method: "GET",
      url: `/recurrences/forecast?year=2099&accountIds=${userB.account1.id}`,
      headers: { Authorization: `Bearer ${userA.token}` },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().detail).toContain("não pertencem ao usuário");
  });
});
