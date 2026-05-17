import type { FastifyInstance } from "fastify";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { registerAndLogin } from "../helpers/auth";
import { resetTables } from "../helpers/resetTables";
import { buildTestApp } from "../setup";
import type { DB } from "@/core/plugins/drizzle";

let app: FastifyInstance;
let db: DB;

type CashflowPoint = { bucket: string; income: number; expense: number };

describe("GET /transactions/cashflow", () => {
  beforeEach(async () => {
    const built = await buildTestApp();
    app = built.app;
    db = built.db;

    await resetTables(db);
  });

  afterEach(async () => {
    await app.close();
  });

  async function seedBasicData() {
    const email = `user_${crypto.randomUUID()}@test.com`;
    const { token } = await registerAndLogin(app, db, email);

    const account = (
      await app.inject({
        method: "POST",
        url: "/accounts",
        headers: { Authorization: `Bearer ${token}` },
        payload: { name: "Conta", type: "cash" },
      })
    ).json();

    const incomeCat = (
      await app.inject({
        method: "POST",
        url: "/categories",
        headers: { Authorization: `Bearer ${token}` },
        payload: { name: "Salário", type: "income" },
      })
    ).json();

    const expenseCat = (
      await app.inject({
        method: "POST",
        url: "/categories",
        headers: { Authorization: `Bearer ${token}` },
        payload: { name: "Mercado", type: "expense" },
      })
    ).json();

    return { token, account, incomeCat, expenseCat };
  }

  async function createTransaction(
    token: string,
    payload: {
      accountId: string;
      categoryId: string;
      type: "income" | "expense";
      amount: number;
      date: string;
    },
  ) {
    return app.inject({
      method: "POST",
      url: "/transactions",
      headers: { Authorization: `Bearer ${token}` },
      payload,
    });
  }

  it("deve agregar receitas e despesas por dia (granularity=day) preenchendo buckets vazios com 0", async () => {
    const { token, account, incomeCat, expenseCat } = await seedBasicData();

    await createTransaction(token, {
      accountId: account.id,
      categoryId: incomeCat.id,
      type: "income",
      amount: 1000,
      date: "2026-04-01",
    });
    await createTransaction(token, {
      accountId: account.id,
      categoryId: expenseCat.id,
      type: "expense",
      amount: 200,
      date: "2026-04-01",
    });
    await createTransaction(token, {
      accountId: account.id,
      categoryId: expenseCat.id,
      type: "expense",
      amount: 50,
      date: "2026-04-03",
    });

    const res = await app.inject({
      method: "GET",
      url: "/transactions/cashflow?startDate=2026-04-01&endDate=2026-04-03&granularity=day",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const series = res.json() as CashflowPoint[];
    expect(series).toHaveLength(3);
    expect(series[0]).toEqual({ bucket: "2026-04-01", income: 1000, expense: 200 });
    expect(series[1]).toEqual({ bucket: "2026-04-02", income: 0, expense: 0 });
    expect(series[2]).toEqual({ bucket: "2026-04-03", income: 0, expense: 50 });
  });

  it("deve agrupar por semana (granularity=week) iniciando na segunda-feira", async () => {
    const { token, account, expenseCat } = await seedBasicData();

    // 2026-04-06 é segunda; 2026-04-07 é terça; 2026-04-13 é segunda da semana seguinte
    await createTransaction(token, {
      accountId: account.id,
      categoryId: expenseCat.id,
      type: "expense",
      amount: 100,
      date: "2026-04-07",
    });
    await createTransaction(token, {
      accountId: account.id,
      categoryId: expenseCat.id,
      type: "expense",
      amount: 200,
      date: "2026-04-13",
    });

    const res = await app.inject({
      method: "GET",
      url: "/transactions/cashflow?startDate=2026-04-06&endDate=2026-04-19&granularity=week",
      headers: { Authorization: `Bearer ${token}` },
    });

    const series = res.json() as CashflowPoint[];
    expect(series.length).toBeGreaterThanOrEqual(2);
    const monday1 = series.find((p) => p.bucket === "2026-04-06");
    const monday2 = series.find((p) => p.bucket === "2026-04-13");
    expect(monday1?.expense).toBe(100);
    expect(monday2?.expense).toBe(200);
  });

  it("deve agrupar por mês (granularity=month)", async () => {
    const { token, account, incomeCat } = await seedBasicData();

    await createTransaction(token, {
      accountId: account.id,
      categoryId: incomeCat.id,
      type: "income",
      amount: 3000,
      date: "2026-01-15",
    });
    await createTransaction(token, {
      accountId: account.id,
      categoryId: incomeCat.id,
      type: "income",
      amount: 1500,
      date: "2026-03-10",
    });

    const res = await app.inject({
      method: "GET",
      url: "/transactions/cashflow?startDate=2026-01-01&endDate=2026-03-31&granularity=month",
      headers: { Authorization: `Bearer ${token}` },
    });

    const series = res.json() as CashflowPoint[];
    expect(series).toHaveLength(3);
    expect(series.find((p) => p.bucket === "2026-01-01")?.income).toBe(3000);
    expect(series.find((p) => p.bucket === "2026-02-01")?.income).toBe(0);
    expect(series.find((p) => p.bucket === "2026-03-01")?.income).toBe(1500);
  });

  it("deve filtrar por accountId", async () => {
    const { token, account, expenseCat } = await seedBasicData();

    const account2 = (
      await app.inject({
        method: "POST",
        url: "/accounts",
        headers: { Authorization: `Bearer ${token}` },
        payload: { name: "Conta 2", type: "cash" },
      })
    ).json();

    await createTransaction(token, {
      accountId: account.id,
      categoryId: expenseCat.id,
      type: "expense",
      amount: 100,
      date: "2026-04-01",
    });
    await createTransaction(token, {
      accountId: account2.id,
      categoryId: expenseCat.id,
      type: "expense",
      amount: 999,
      date: "2026-04-01",
    });

    const res = await app.inject({
      method: "GET",
      url: `/transactions/cashflow?startDate=2026-04-01&endDate=2026-04-01&granularity=day&accountId=${account.id}`,
      headers: { Authorization: `Bearer ${token}` },
    });

    const series = res.json() as CashflowPoint[];
    expect(series[0].expense).toBe(100);
  });

  it("deve respeitar excludeHiddenAccounts=true", async () => {
    const { token, account, expenseCat } = await seedBasicData();

    const hidden = (
      await app.inject({
        method: "POST",
        url: "/accounts",
        headers: { Authorization: `Bearer ${token}` },
        payload: { name: "Conta escondida", type: "cash", isHiddenOnDashboard: true },
      })
    ).json();

    await createTransaction(token, {
      accountId: account.id,
      categoryId: expenseCat.id,
      type: "expense",
      amount: 100,
      date: "2026-04-01",
    });
    await createTransaction(token, {
      accountId: hidden.id,
      categoryId: expenseCat.id,
      type: "expense",
      amount: 5000,
      date: "2026-04-01",
    });

    const res = await app.inject({
      method: "GET",
      url: "/transactions/cashflow?startDate=2026-04-01&endDate=2026-04-01&granularity=day&excludeHiddenAccounts=true",
      headers: { Authorization: `Bearer ${token}` },
    });

    const series = res.json() as CashflowPoint[];
    expect(series[0].expense).toBe(100);
  });

  it("não deve retornar dados de outro usuário", async () => {
    const userA = await seedBasicData();
    const userB = await seedBasicData();

    await createTransaction(userA.token, {
      accountId: userA.account.id,
      categoryId: userA.expenseCat.id,
      type: "expense",
      amount: 500,
      date: "2026-04-01",
    });

    const res = await app.inject({
      method: "GET",
      url: "/transactions/cashflow?startDate=2026-04-01&endDate=2026-04-01&granularity=day",
      headers: { Authorization: `Bearer ${userB.token}` },
    });

    const series = res.json() as CashflowPoint[];
    expect(series[0]).toEqual({ bucket: "2026-04-01", income: 0, expense: 0 });
  });

  it("deve retornar 400 quando startDate ausente", async () => {
    const { token } = await seedBasicData();

    const res = await app.inject({
      method: "GET",
      url: "/transactions/cashflow?endDate=2026-04-01&granularity=day",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(400);
  });

  it("deve retornar 400 quando granularity é inválida", async () => {
    const { token } = await seedBasicData();

    const res = await app.inject({
      method: "GET",
      url: "/transactions/cashflow?startDate=2026-04-01&endDate=2026-04-01&granularity=year",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(400);
  });
});
