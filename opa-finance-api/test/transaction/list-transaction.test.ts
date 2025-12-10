// test/transactions/list-transactions.test.ts
import type { FastifyInstance } from "fastify";
import { describe, it, beforeEach, afterEach, expect } from "vitest";

import { registerAndLogin } from "../helpers/auth";
import { buildTestApp } from "../setup";

import type { DB } from "@/core/plugins/drizzle";
import { users, accounts, categories, transactions } from "@/db/schema";

let app: FastifyInstance;
let db: DB;

describe("GET /transactions", () => {
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

  it("deve listar apenas transações do usuário", async () => {
    const { token, user } = await registerAndLogin(app, db);

    const [acc] = await db
      .insert(accounts)
      .values({ name: "Conta", type: "cash", userId: user.id, initialBalance: "0" })
      .returning();

    const [cat] = await db
      .insert(categories)
      .values({ name: "Salário", type: "income", userId: user.id })
      .returning();

    // cria transação
    await db.insert(transactions).values({
      userId: user.id,
      accountId: acc.id,
      categoryId: cat.id,
      type: "income",
      amount: "100",
      date: "2025-01-01",
    });

    const res = await app.inject({
      method: "GET",
      url: "/transactions",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().length).toBe(1);
  });
});
