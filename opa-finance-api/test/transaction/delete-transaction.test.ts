// test/transactions/delete-transaction.test.ts
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { describe, it, beforeEach, afterEach, expect } from "vitest";

import { registerAndLogin } from "../helpers/auth";
import { buildTestApp } from "../setup";

import type { DB } from "@/core/plugins/drizzle";
import { users, accounts, categories, transactions } from "@/db/schema";

let app: FastifyInstance;
let db: DB;

describe("DELETE /transactions/:id", () => {
  beforeEach(async () => {
    const built = await buildTestApp();
    app = built.app;
    db = built.db;

    await db.delete(transactions);
    await db.delete(categories);
    await db.delete(accounts);
    await db.delete(users);

    await db.insert(categories).values({
      userId: null,
      name: "Transferência",
      type: "expense",
      system: true,
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it("deve deletar transação com sucesso", async () => {
    const { token, user } = await registerAndLogin(app, db);

    const [acc] = await db
      .insert(accounts)
      .values({ name: "Conta", type: "cash", userId: user.id, initialBalance: "0" })
      .returning();

    const [cat] = await db
      .insert(categories)
      .values({ name: "Mercado", type: "expense", userId: user.id })
      .returning();

    const [tx] = await db
      .insert(transactions)
      .values({
        userId: user.id,
        accountId: acc.id,
        categoryId: cat.id,
        type: "expense",
        amount: "20",
        date: "2025-01-01",
      })
      .returning();

    const res = await app.inject({
      method: "DELETE",
      url: `/transactions/${tx.id}`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().message).toBe("Transação removida com sucesso.");
  });

  it("deve retornar 404 ao tentar deletar transação inexistente", async () => {
    const { token } = await registerAndLogin(app, db);

    const res = await app.inject({
      method: "DELETE",
      url: "/transactions/00000000-0000-0000-0000-000000000000",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it("não deve permitir deletar transação de outro usuário", async () => {
    const { user: userA } = await registerAndLogin(app, db, "a@test.com");
    const { token: tokenB } = await registerAndLogin(app, db, "b@test.com");

    const [acc] = await db
      .insert(accounts)
      .values({ name: "Conta A", type: "cash", userId: userA.id, initialBalance: "0" })
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
        amount: "99",
        date: "2025-01-01",
      })
      .returning();

    const res = await app.inject({
      method: "DELETE",
      url: `/transactions/${tx.id}`,
      headers: { Authorization: `Bearer ${tokenB}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it("deve remover as duas transações quando for transferência", async () => {
    const { token, user } = await registerAndLogin(app, db);

    const [fromAccount] = await db
      .insert(accounts)
      .values({ name: "Conta A", type: "cash", userId: user.id })
      .returning();

    const [toAccount] = await db
      .insert(accounts)
      .values({ name: "Conta B", type: "cash", userId: user.id })
      .returning();

    const transferRes = await app.inject({
      method: "POST",
      url: "/transfers",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        fromAccountId: fromAccount.id,
        toAccountId: toAccount.id,
        amount: 50,
        date: "2025-01-15",
        description: "Transferência teste",
      },
    });

    expect(transferRes.statusCode).toBe(201);
    const transferBody = transferRes.json();

    const transferTransactions = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(eq(transactions.transferId, transferBody.id));

    const res = await app.inject({
      method: "DELETE",
      url: `/transactions/${transferTransactions[0].id}`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().message).toBe("Transferência removida com sucesso.");

    const remaining = await db
      .select()
      .from(transactions)
      .where(eq(transactions.transferId, transferBody.id));

    expect(remaining.length).toBe(0);
  });
});
