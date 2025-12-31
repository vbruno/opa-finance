// test/transfers/create-transfer.test.ts
import { and, eq, isNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { describe, it, beforeEach, afterEach, expect } from "vitest";

import { registerAndLogin } from "../helpers/auth";
import { buildTestApp } from "../setup";

import type { DB } from "@/core/plugins/drizzle";
import { users, accounts, categories, transactions } from "@/db/schema";

let app: FastifyInstance;
let db: DB;

describe("POST /transfers", () => {
  beforeEach(async () => {
    const built = await buildTestApp();
    app = built.app;
    db = built.db;

    await db.delete(transactions);
    await db.delete(accounts);
    await db.delete(categories);
    await db.delete(users);

    // Cria categoria de sistema "Transferência" (necessária para transferências)
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

  it("deve criar transferência entre contas com sucesso", async () => {
    const { token, user } = await registerAndLogin(app, db);

    // Cria conta de origem
    const [fromAccount] = await db
      .insert(accounts)
      .values({
        name: "Conta Corrente",
        type: "checking_account",
        userId: user.id,
        initialBalance: "1000",
      })
      .returning();

    // Cria conta de destino
    const [toAccount] = await db
      .insert(accounts)
      .values({
        name: "Poupança",
        type: "savings_account",
        userId: user.id,
        initialBalance: "500",
      })
      .returning();

    const payload = {
      fromAccountId: fromAccount.id,
      toAccountId: toAccount.id,
      amount: 200,
      date: "2025-01-15",
      description: "Transferência para poupança",
    };

    const res = await app.inject({
      method: "POST",
      url: "/transfers",
      headers: { Authorization: `Bearer ${token}` },
      payload,
    });

    expect(res.statusCode).toBe(201);

    const body = res.json();
    expect(body).toHaveProperty("id"); // transferId
    expect(body).toHaveProperty("fromAccount");
    expect(body).toHaveProperty("toAccount");

    expect(body.fromAccount.accountId).toBe(fromAccount.id);
    expect(body.fromAccount.type).toBe("expense");
    expect(body.fromAccount.amount).toBe(200);
    expect(body.fromAccount.transferId).toBe(body.id);

    expect(body.toAccount.accountId).toBe(toAccount.id);
    expect(body.toAccount.type).toBe("income");
    expect(body.toAccount.amount).toBe(200);
    expect(body.toAccount.transferId).toBe(body.id);

    // Verifica que ambas as transações foram criadas no banco
    const allTransactions = await db
      .select()
      .from(transactions)
      .where(eq(transactions.transferId, body.id));

    expect(allTransactions).toHaveLength(2);
    expect(allTransactions[0].transferId).toBe(allTransactions[1].transferId);
  });

  it("deve falhar ao tentar transferir para a mesma conta (400)", async () => {
    const { token, user } = await registerAndLogin(app, db);

    const [account] = await db
      .insert(accounts)
      .values({
        name: "Conta Única",
        type: "cash",
        userId: user.id,
        initialBalance: "1000",
      })
      .returning();

    const res = await app.inject({
      method: "POST",
      url: "/transfers",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        fromAccountId: account.id,
        toAccountId: account.id, // mesma conta
        amount: 100,
        date: "2025-01-15",
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.detail).toContain("diferentes");
  });

  it("deve falhar ao transferir de conta que não pertence ao usuário (403)", async () => {
    const { user: userA } = await registerAndLogin(app, db, "userA@test.com");
    const { token: tokenB, user: userB } = await registerAndLogin(app, db, "userB@test.com");

    // Conta do usuário A
    const [accountA] = await db
      .insert(accounts)
      .values({
        name: "Conta A",
        type: "cash",
        userId: userA.id,
        initialBalance: "1000",
      })
      .returning();

    // Conta do usuário B
    const [accountB] = await db
      .insert(accounts)
      .values({
        name: "Conta B",
        type: "cash",
        userId: userB.id,
        initialBalance: "500",
      })
      .returning();

    // Usuário B tenta transferir da conta do usuário A
    const res = await app.inject({
      method: "POST",
      url: "/transfers",
      headers: { Authorization: `Bearer ${tokenB}` },
      payload: {
        fromAccountId: accountA.id, // conta do usuário A
        toAccountId: accountB.id,
        amount: 100,
        date: "2025-01-15",
      },
    });

    expect(res.statusCode).toBe(403);
  });

  it("deve falhar ao transferir para conta que não pertence ao usuário (403)", async () => {
    const { user: userA } = await registerAndLogin(app, db, "userA@test.com");
    const { token: tokenB, user: userB } = await registerAndLogin(app, db, "userB@test.com");

    // Conta do usuário A
    const [accountA] = await db
      .insert(accounts)
      .values({
        name: "Conta A",
        type: "cash",
        userId: userA.id,
        initialBalance: "1000",
      })
      .returning();

    // Conta do usuário B
    const [accountB] = await db
      .insert(accounts)
      .values({
        name: "Conta B",
        type: "cash",
        userId: userB.id,
        initialBalance: "500",
      })
      .returning();

    // Usuário B tenta transferir para a conta do usuário A
    const res = await app.inject({
      method: "POST",
      url: "/transfers",
      headers: { Authorization: `Bearer ${tokenB}` },
      payload: {
        fromAccountId: accountB.id,
        toAccountId: accountA.id, // conta do usuário A
        amount: 100,
        date: "2025-01-15",
      },
    });

    expect(res.statusCode).toBe(403);
  });

  it("deve falhar com payload inválido (400)", async () => {
    const { token } = await registerAndLogin(app, db);

    const res = await app.inject({
      method: "POST",
      url: "/transfers",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        // falta campos obrigatórios
        amount: 100,
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it("deve falhar com data inválida (400)", async () => {
    const { token, user } = await registerAndLogin(app, db);

    const [account1] = await db
      .insert(accounts)
      .values({
        name: "Conta 1",
        type: "cash",
        userId: user.id,
        initialBalance: "1000",
      })
      .returning();

    const [account2] = await db
      .insert(accounts)
      .values({
        name: "Conta 2",
        type: "cash",
        userId: user.id,
        initialBalance: "500",
      })
      .returning();

    const res = await app.inject({
      method: "POST",
      url: "/transfers",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        fromAccountId: account1.id,
        toAccountId: account2.id,
        amount: 100,
        date: "data-invalida", // data inválida
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it("deve falhar com valor zero ou negativo (400)", async () => {
    const { token, user } = await registerAndLogin(app, db);

    const [account1] = await db
      .insert(accounts)
      .values({
        name: "Conta 1",
        type: "cash",
        userId: user.id,
        initialBalance: "1000",
      })
      .returning();

    const [account2] = await db
      .insert(accounts)
      .values({
        name: "Conta 2",
        type: "cash",
        userId: user.id,
        initialBalance: "500",
      })
      .returning();

    const res = await app.inject({
      method: "POST",
      url: "/transfers",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        fromAccountId: account1.id,
        toAccountId: account2.id,
        amount: 0, // valor inválido
        date: "2025-01-15",
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it("deve retornar 401 sem token", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/transfers",
      payload: {
        fromAccountId: "00000000-0000-0000-0000-000000000000",
        toAccountId: "00000000-0000-0000-0000-000000000000",
        amount: 100,
        date: "2025-01-15",
      },
    });

    expect(res.statusCode).toBe(401);
  });

  it("deve usar a categoria de sistema Transferência em ambas as transações", async () => {
    const { token, user } = await registerAndLogin(app, db);

    const [fromAccount] = await db
      .insert(accounts)
      .values({
        name: "Conta Origem",
        type: "cash",
        userId: user.id,
        initialBalance: "1000",
      })
      .returning();

    const [toAccount] = await db
      .insert(accounts)
      .values({
        name: "Conta Destino",
        type: "cash",
        userId: user.id,
        initialBalance: "500",
      })
      .returning();

    const res = await app.inject({
      method: "POST",
      url: "/transfers",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        fromAccountId: fromAccount.id,
        toAccountId: toAccount.id,
        amount: 150,
        date: "2025-01-15",
      },
    });

    expect(res.statusCode).toBe(201);

    const body = res.json();
    const transferId = body.id;

    // Busca as transações criadas
    const createdTransactions = await db
      .select()
      .from(transactions)
      .where(eq(transactions.transferId, transferId));

    expect(createdTransactions).toHaveLength(2);

    // Busca a categoria de sistema Transferência
    const [transferCategory] = await db
      .select()
      .from(categories)
      .where(
        and(
          eq(categories.name, "Transferência"),
          eq(categories.system, true),
          isNull(categories.userId),
        ),
      );

    expect(transferCategory).toBeDefined();

    // Verifica que ambas as transações usam a categoria de sistema
    expect(createdTransactions[0].categoryId).toBe(transferCategory.id);
    expect(createdTransactions[1].categoryId).toBe(transferCategory.id);
  });
});
