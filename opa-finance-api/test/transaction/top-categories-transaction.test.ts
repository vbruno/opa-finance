import type { FastifyInstance } from "fastify";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { registerAndLogin } from "../helpers/auth";
import { resetTables } from "../helpers/resetTables";
import { buildTestApp } from "../setup";

import type { DB } from "@/core/plugins/drizzle";

describe("GET /transactions/top-categories", () => {
  let app: FastifyInstance;
  let db: DB;

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

    const account2 = (
      await app.inject({
        method: "POST",
        url: "/accounts",
        headers: { Authorization: `Bearer ${token}` },
        payload: { name: "Conta 2", type: "cash" },
      })
    ).json();

    const catA = (
      await app.inject({
        method: "POST",
        url: "/categories",
        headers: { Authorization: `Bearer ${token}` },
        payload: { name: "Mercado", type: "expense" },
      })
    ).json();

    const catB = (
      await app.inject({
        method: "POST",
        url: "/categories",
        headers: { Authorization: `Bearer ${token}` },
        payload: { name: "Transporte", type: "expense" },
      })
    ).json();

    const subA1 = (
      await app.inject({
        method: "POST",
        url: "/subcategories",
        headers: { Authorization: `Bearer ${token}` },
        payload: { name: "Supermercado", categoryId: catA.id },
      })
    ).json();

    const subA2 = (
      await app.inject({
        method: "POST",
        url: "/subcategories",
        headers: { Authorization: `Bearer ${token}` },
        payload: { name: "Feira", categoryId: catA.id },
      })
    ).json();

    const subB1 = (
      await app.inject({
        method: "POST",
        url: "/subcategories",
        headers: { Authorization: `Bearer ${token}` },
        payload: { name: "Gasolina", categoryId: catB.id },
      })
    ).json();

    return { token, account, account2, catA, catB, subA1, subA2, subB1 };
  }

  async function createExpense(
    token: string,
    accountId: string,
    categoryId: string,
    amount: number,
    date: string,
    subcategoryId?: string,
  ) {
    await app.inject({
      method: "POST",
      url: "/transactions",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        accountId,
        categoryId,
        subcategoryId,
        type: "expense",
        amount,
        date,
      },
    });
  }

  it("deve retornar top 5 por categoria com percentual", async () => {
    const { token, account, account2, catA, catB, subA1, subA2, subB1 } =
      await seedBasicData();

    await createExpense(token, account.id, catA.id, 100, "2025-01-01", subA1.id);
    await createExpense(token, account.id, catA.id, 50, "2025-01-02", subA2.id);
    await createExpense(token, account.id, catB.id, 50, "2025-01-03", subB1.id);

    await createExpense(token, account2.id, catB.id, 999, "2025-01-02", subB1.id);

    const res = await app.inject({
      method: "GET",
      url: `/transactions/top-categories?accountId=${account.id}&startDate=2025-01-01&endDate=2025-01-31`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.length).toBe(2);
    expect(body[0].name).toBe("Mercado");
    expect(body[0].totalAmount).toBe(150);
    expect(body[1].name).toBe("Transporte");
    expect(body[1].totalAmount).toBe(50);

    expect(body[0].percentage).toBeCloseTo(75, 2);
    expect(body[1].percentage).toBeCloseTo(25, 2);
  });

  it("deve retornar top 5 por subcategoria com contexto da categoria", async () => {
    const { token, account, catA, catB, subA1, subA2, subB1 } = await seedBasicData();

    await createExpense(token, account.id, catA.id, 100, "2025-01-01", subA1.id);
    await createExpense(token, account.id, catA.id, 50, "2025-01-02", subA2.id);
    await createExpense(token, account.id, catB.id, 50, "2025-01-03", subB1.id);

    const res = await app.inject({
      method: "GET",
      url: "/transactions/top-categories?groupBy=subcategory",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.length).toBe(3);
    expect(body[0].name).toBe("Supermercado");
    expect(body[0].categoryName).toBe("Mercado");
    expect(body[0].totalAmount).toBe(100);

    expect(body[1].name).toBe("Feira");
    expect(body[1].categoryName).toBe("Mercado");
    expect(body[1].totalAmount).toBe(50);

    expect(body[2].name).toBe("Gasolina");
    expect(body[2].categoryName).toBe("Transporte");
    expect(body[2].totalAmount).toBe(50);
  });

  it("deve retornar 403 ao usar accountId de outro usuário", async () => {
    const userA = await seedBasicData();
    const userB = await seedBasicData();

    const res = await app.inject({
      method: "GET",
      url: `/transactions/top-categories?accountId=${userB.account.id}`,
      headers: { Authorization: `Bearer ${userA.token}` },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().detail).toBe("Acesso negado à conta.");
  });

  it("deve validar datas com o mesmo formato do summary", async () => {
    const { token } = await seedBasicData();

    const res = await app.inject({
      method: "GET",
      url: "/transactions/top-categories?startDate=2025-1-01",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().title).toBe("Validation Error");
  });
});
