import type { FastifyInstance } from "fastify";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { registerAndLogin } from "../helpers/auth";
import { resetTables } from "../helpers/resetTables";
import { buildTestApp } from "../setup";

import type { DB } from "@/core/plugins/drizzle";

describe("GET /transactions/descriptions", () => {
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

    const category = (
      await app.inject({
        method: "POST",
        url: "/categories",
        headers: { Authorization: `Bearer ${token}` },
        payload: { name: "Mercado", type: "expense" },
      })
    ).json();

    return { token, account, account2, category };
  }

  async function createExpense(
    token: string,
    accountId: string,
    categoryId: string,
    description: string,
    date: string,
  ) {
    await app.inject({
      method: "POST",
      url: "/transactions",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        accountId,
        categoryId,
        type: "expense",
        amount: 10,
        date,
        description,
      },
    });
  }

  it("deve retornar descrições únicas ordenadas pela data mais recente", async () => {
    const { token, account, category } = await seedBasicData();

    await createExpense(token, account.id, category.id, "Supermercado", "2025-01-01");
    await createExpense(token, account.id, category.id, "supermercado", "2025-01-03");
    await createExpense(token, account.id, category.id, "Ônibus", "2025-01-02");

    const res = await app.inject({
      method: "GET",
      url: `/transactions/descriptions?accountId=${account.id}`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.items.length).toBe(2);
    expect(body.items[0]).toBe("Ônibus");
    expect(body.items[1]).toBe("supermercado");
  });

  it("deve respeitar filtro por accountId do usuário", async () => {
    const { token, account, account2, category } = await seedBasicData();

    await createExpense(token, account.id, category.id, "Supermercado", "2025-01-01");
    await createExpense(token, account2.id, category.id, "Academia", "2025-01-01");

    const res = await app.inject({
      method: "GET",
      url: `/transactions/descriptions?accountId=${account.id}`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.items).toEqual(["Supermercado"]);
  });

  it("deve retornar 403 ao usar accountId de outro usuário", async () => {
    const userA = await seedBasicData();
    const userB = await seedBasicData();

    const res = await app.inject({
      method: "GET",
      url: `/transactions/descriptions?accountId=${userB.account.id}`,
      headers: { Authorization: `Bearer ${userA.token}` },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().detail).toBe("Acesso negado à conta.");
  });

  it("deve aplicar limite e filtro de busca", async () => {
    const { token, account, category } = await seedBasicData();

    await createExpense(token, account.id, category.id, "Supermercado", "2025-01-01");
    await createExpense(token, account.id, category.id, "Supermercado Extra", "2025-01-02");
    await createExpense(token, account.id, category.id, "Academia", "2025-01-03");

    const res = await app.inject({
      method: "GET",
      url: `/transactions/descriptions?accountId=${account.id}&q=super&limit=1`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.items.length).toBe(1);
  });
});
