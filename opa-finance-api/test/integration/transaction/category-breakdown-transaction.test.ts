import type { FastifyInstance } from "fastify";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { registerAndLogin } from "../helpers/auth";
import { resetTables } from "../helpers/resetTables";
import { buildTestApp } from "../setup";
import type { DB } from "@/core/plugins/drizzle";

let app: FastifyInstance;
let db: DB;

type BreakdownItem = {
  categoryId: string;
  categoryName: string;
  color: string | null;
  totalAmount: number;
  percentage: number;
};

describe("GET /transactions/category-breakdown", () => {
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

    return { token, account };
  }

  async function createCategory(
    token: string,
    payload: { name: string; type: "income" | "expense"; color?: string | null },
  ) {
    return (
      await app.inject({
        method: "POST",
        url: "/categories",
        headers: { Authorization: `Bearer ${token}` },
        payload,
      })
    ).json();
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

  it("deve retornar todas as despesas agrupadas por categoria com color e percentage somando ~100", async () => {
    const { token, account } = await seedBasicData();
    const mercado = await createCategory(token, {
      name: "Mercado",
      type: "expense",
      color: "#ff0000",
    });
    const transporte = await createCategory(token, {
      name: "Transporte",
      type: "expense",
      color: "#00ff00",
    });

    await createTransaction(token, {
      accountId: account.id,
      categoryId: mercado.id,
      type: "expense",
      amount: 300,
      date: "2026-04-10",
    });
    await createTransaction(token, {
      accountId: account.id,
      categoryId: transporte.id,
      type: "expense",
      amount: 100,
      date: "2026-04-15",
    });

    const res = await app.inject({
      method: "GET",
      url: "/transactions/category-breakdown?startDate=2026-04-01&endDate=2026-04-30",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const items = res.json() as BreakdownItem[];
    expect(items).toHaveLength(2);
    expect(items[0].categoryName).toBe("Mercado");
    expect(items[0].totalAmount).toBe(300);
    expect(items[0].color).toBe("#ff0000");
    expect(items[1].categoryName).toBe("Transporte");
    expect(items[1].totalAmount).toBe(100);

    const totalPct = items.reduce((acc, item) => acc + item.percentage, 0);
    expect(totalPct).toBeCloseTo(100, 5);
  });

  it("deve filtrar por type=income retornando apenas receitas", async () => {
    const { token, account } = await seedBasicData();
    const salario = await createCategory(token, { name: "Salário", type: "income" });
    const mercado = await createCategory(token, { name: "Mercado", type: "expense" });

    await createTransaction(token, {
      accountId: account.id,
      categoryId: salario.id,
      type: "income",
      amount: 2000,
      date: "2026-04-01",
    });
    await createTransaction(token, {
      accountId: account.id,
      categoryId: mercado.id,
      type: "expense",
      amount: 500,
      date: "2026-04-02",
    });

    const res = await app.inject({
      method: "GET",
      url: "/transactions/category-breakdown?startDate=2026-04-01&endDate=2026-04-30&type=income",
      headers: { Authorization: `Bearer ${token}` },
    });

    const items = res.json() as BreakdownItem[];
    expect(items).toHaveLength(1);
    expect(items[0].categoryName).toBe("Salário");
    expect(items[0].totalAmount).toBe(2000);
  });

  it("deve retornar categoria com color=null quando não definido", async () => {
    const { token, account } = await seedBasicData();
    const cat = await createCategory(token, { name: "Outros", type: "expense" });

    await createTransaction(token, {
      accountId: account.id,
      categoryId: cat.id,
      type: "expense",
      amount: 50,
      date: "2026-04-05",
    });

    const res = await app.inject({
      method: "GET",
      url: "/transactions/category-breakdown?startDate=2026-04-01&endDate=2026-04-30",
      headers: { Authorization: `Bearer ${token}` },
    });

    const items = res.json() as BreakdownItem[];
    expect(items[0].color).toBeNull();
  });

  it("deve filtrar por accountId", async () => {
    const { token, account } = await seedBasicData();
    const account2 = (
      await app.inject({
        method: "POST",
        url: "/accounts",
        headers: { Authorization: `Bearer ${token}` },
        payload: { name: "Conta 2", type: "cash" },
      })
    ).json();

    const cat = await createCategory(token, { name: "Mercado", type: "expense" });
    await createTransaction(token, {
      accountId: account.id,
      categoryId: cat.id,
      type: "expense",
      amount: 100,
      date: "2026-04-01",
    });
    await createTransaction(token, {
      accountId: account2.id,
      categoryId: cat.id,
      type: "expense",
      amount: 999,
      date: "2026-04-01",
    });

    const res = await app.inject({
      method: "GET",
      url: `/transactions/category-breakdown?startDate=2026-04-01&endDate=2026-04-30&accountId=${account.id}`,
      headers: { Authorization: `Bearer ${token}` },
    });

    const items = res.json() as BreakdownItem[];
    expect(items[0].totalAmount).toBe(100);
  });

  it("deve respeitar excludeHiddenAccounts=true", async () => {
    const { token, account } = await seedBasicData();
    const hidden = (
      await app.inject({
        method: "POST",
        url: "/accounts",
        headers: { Authorization: `Bearer ${token}` },
        payload: { name: "Conta escondida", type: "cash", isHiddenOnDashboard: true },
      })
    ).json();
    const cat = await createCategory(token, { name: "Mercado", type: "expense" });

    await createTransaction(token, {
      accountId: account.id,
      categoryId: cat.id,
      type: "expense",
      amount: 100,
      date: "2026-04-01",
    });
    await createTransaction(token, {
      accountId: hidden.id,
      categoryId: cat.id,
      type: "expense",
      amount: 9000,
      date: "2026-04-01",
    });

    const res = await app.inject({
      method: "GET",
      url: "/transactions/category-breakdown?startDate=2026-04-01&endDate=2026-04-30&excludeHiddenAccounts=true",
      headers: { Authorization: `Bearer ${token}` },
    });

    const items = res.json() as BreakdownItem[];
    expect(items).toHaveLength(1);
    expect(items[0].totalAmount).toBe(100);
  });

  it("não deve retornar dados de outro usuário", async () => {
    const userA = await seedBasicData();
    const userB = await seedBasicData();

    const catA = await createCategory(userA.token, { name: "Mercado A", type: "expense" });
    await createTransaction(userA.token, {
      accountId: userA.account.id,
      categoryId: catA.id,
      type: "expense",
      amount: 500,
      date: "2026-04-01",
    });

    const res = await app.inject({
      method: "GET",
      url: "/transactions/category-breakdown?startDate=2026-04-01&endDate=2026-04-30",
      headers: { Authorization: `Bearer ${userB.token}` },
    });

    const items = res.json() as BreakdownItem[];
    expect(items).toEqual([]);
  });
});
