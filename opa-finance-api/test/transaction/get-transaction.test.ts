// test/transactions/get-transaction.test.ts
import type { FastifyInstance } from "fastify";
import { describe, it, beforeEach, afterEach, expect } from "vitest";

import type { DB } from "../../src/core/plugins/drizzle";
import { users, accounts, categories, transactions } from "../../src/db/schema";
import { registerAndLogin } from "../helpers/auth";
import { buildTestApp } from "../setup";

let app: FastifyInstance;
let db: DB;

describe("GET /transactions/:id", () => {
  beforeEach(async () => {
    const built = await buildTestApp();
    app = built.app;
    db = built.db;

    await db.delete(transactions);
    await db.delete(categories);
    await db.delete(accounts);
    await db.delete(users);
  });

  afterEach(async () => {
    await app.close();
  });

  it("deve obter transação com sucesso", async () => {
    const { token, user } = await registerAndLogin(app, db);

    const [acc] = await db
      .insert(accounts)
      .values({ name: "Conta", type: "cash", userId: user.id, initialBalance: "0" })
      .returning();

    const [cat] = await db
      .insert(categories)
      .values({ name: "Salário", type: "income", userId: user.id })
      .returning();

    const [tx] = await db
      .insert(transactions)
      .values({
        userId: user.id,
        accountId: acc.id,
        categoryId: cat.id,
        type: "income",
        amount: "500",
        date: "2025-01-05",
      })
      .returning();

    const res = await app.inject({
      method: "GET",
      url: `/transactions/${tx.id}`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(tx.id);
    expect(res.json().amount).toBe(500);
  });

  it("deve retornar 404 para id inexistente", async () => {
    const { token } = await registerAndLogin(app, db);

    const res = await app.inject({
      method: "GET",
      url: "/transactions/00000000-0000-0000-0000-000000000000",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it("deve retornar 403 ao acessar transação de outro usuário", async () => {
    const { user: userA } = await registerAndLogin(app, db, "a@test.com");
    const { token: tokenB } = await registerAndLogin(app, db, "b@test.com");

    const [acc] = await db
      .insert(accounts)
      .values({ name: "ContaA", type: "cash", userId: userA.id, initialBalance: "0" })
      .returning();

    const [cat] = await db
      .insert(categories)
      .values({ name: "Saúde", type: "expense", userId: userA.id })
      .returning();

    const [tx] = await db
      .insert(transactions)
      .values({
        userId: userA.id,
        accountId: acc.id,
        categoryId: cat.id,
        type: "expense",
        amount: "50",
        date: "2025-01-05",
      })
      .returning();

    const res = await app.inject({
      method: "GET",
      url: `/transactions/${tx.id}`,
      headers: { Authorization: `Bearer ${tokenB}` },
    });

    expect(res.statusCode).toBe(403);
  });
});
