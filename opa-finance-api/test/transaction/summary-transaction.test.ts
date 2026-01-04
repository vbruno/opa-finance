import type { FastifyInstance } from "fastify";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { registerAndLogin } from "../helpers/auth";
import { resetTables } from "../helpers/resetTables";
import { buildTestApp } from "../setup";

import type { DB } from "@/core/plugins/drizzle";

let app: FastifyInstance;
let db: DB;

describe("GET /transactions/summary", () => {
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

  it("deve retornar income, expense e balance corretamente", async () => {
    const { token, account, incomeCat, expenseCat } = await seedBasicData();

    await app.inject({
      method: "POST",
      url: "/transactions",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        accountId: account.id,
        categoryId: incomeCat.id,
        type: "income",
        amount: 3000,
        date: "2025-01-01",
      },
    });

    await app.inject({
      method: "POST",
      url: "/transactions",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        accountId: account.id,
        categoryId: expenseCat.id,
        type: "expense",
        amount: 1200,
        date: "2025-01-02",
      },
    });

    const res = await app.inject({
      method: "GET",
      url: "/transactions/summary",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);

    expect(res.json()).toEqual({
      income: 3000,
      expense: 1200,
      balance: 1800,
    });
  });

  it("deve respeitar filtro por período", async () => {
    const { token, account, incomeCat } = await seedBasicData();

    await app.inject({
      method: "POST",
      url: "/transactions",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        accountId: account.id,
        categoryId: incomeCat.id,
        type: "income",
        amount: 1000,
        date: "2025-01-01",
      },
    });

    await app.inject({
      method: "POST",
      url: "/transactions",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        accountId: account.id,
        categoryId: incomeCat.id,
        type: "income",
        amount: 2000,
        date: "2025-02-01",
      },
    });

    const res = await app.inject({
      method: "GET",
      url: "/transactions/summary?startDate=2025-02-01&endDate=2025-02-28",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.json()).toEqual({
      income: 2000,
      expense: 0,
      balance: 2000,
    });
  });

  it("não deve somar transações de outro usuário", async () => {
    const userA = await seedBasicData();
    const userB = await seedBasicData();

    await app.inject({
      method: "POST",
      url: "/transactions",
      headers: { Authorization: `Bearer ${userA.token}` },
      payload: {
        accountId: userA.account.id,
        categoryId: userA.incomeCat.id,
        type: "income",
        amount: 500,
        date: "2025-01-01",
      },
    });

    const res = await app.inject({
      method: "GET",
      url: "/transactions/summary",
      headers: { Authorization: `Bearer ${userB.token}` },
    });

    expect(res.json()).toEqual({
      income: 0,
      expense: 0,
      balance: 0,
    });
  });

  it("deve retornar 403 ao usar accountId de outro usuário", async () => {
    const userA = await seedBasicData();
    const userB = await seedBasicData();

    const res = await app.inject({
      method: "GET",
      url: `/transactions/summary?accountId=${userB.account.id}`,
      headers: { Authorization: `Bearer ${userA.token}` },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().detail).toBe("Acesso negado à conta.");
  });

  it("deve retornar zeros quando não houver transações", async () => {
    const { token } = await seedBasicData();

    const res = await app.inject({
      method: "GET",
      url: "/transactions/summary",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.json()).toEqual({
      income: 0,
      expense: 0,
      balance: 0,
    });
  });
});
