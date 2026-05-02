// test/transactions/create-transaction.test.ts
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { describe, it, beforeEach, afterEach, expect } from "vitest";

import { registerAndLogin } from "../helpers/auth";
import { buildTestApp } from "../setup";
import type { DB } from "@/core/plugins/drizzle";
import {
  users,
  accounts,
  categories,
  recurrenceOccurrences,
  recurrences,
  subcategories,
  transactions,
} from "@/db/schema";

let app: FastifyInstance;
let db: DB;

describe("POST /transactions", () => {
  beforeEach(async () => {
    const built = await buildTestApp();
    app = built.app;
    db = built.db;

    await db.delete(transactions);
    await db.delete(subcategories);
    await db.delete(categories);
    await db.delete(accounts);
    await db.delete(users);
  });

  afterEach(async () => {
    await app.close();
  });

  it("deve criar transação com sucesso", async () => {
    const { token, user } = await registerAndLogin(app, db);

    // cria conta
    const [acc] = await db
      .insert(accounts)
      .values({ name: "Carteira", type: "cash", userId: user.id, initialBalance: "0" })
      .returning();

    // cria categoria
    const [cat] = await db
      .insert(categories)
      .values({ name: "Salário", type: "income", userId: user.id })
      .returning();

    const payload = {
      accountId: acc.id,
      categoryId: cat.id,
      type: "income",
      amount: 1500,
      date: "2025-01-01",
      description: "Recebimento de salário",
    };

    const res = await app.inject({
      method: "POST",
      url: "/transactions",
      headers: { Authorization: `Bearer ${token}` },
      payload,
    });

    expect(res.statusCode).toBe(201);

    const body = res.json();
    expect(body.amount).toBe(1500);
    expect(body.categoryId).toBe(cat.id);
    expect(body.accountId).toBe(acc.id);
  });

  it("deve falhar ao criar transação inválida (400)", async () => {
    const { token } = await registerAndLogin(app, db);

    const res = await app.inject({
      method: "POST",
      url: "/transactions",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        // falta categoryId, accountId, amount, etc.
        type: "income",
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it("deve retornar 401 sem token", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/transactions",
      payload: {},
    });

    expect(res.statusCode).toBe(401);
  });

  it("deve permitir categoria Transferência com tipo income", async () => {
    const { token, user } = await registerAndLogin(app, db);

    const [acc] = await db
      .insert(accounts)
      .values({ name: "Carteira", type: "cash", userId: user.id, initialBalance: "0" })
      .returning();

    const [transferCategory] = await db
      .insert(categories)
      .values({ name: "Transferência", type: "expense", userId: null, system: true })
      .returning();

    const res = await app.inject({
      method: "POST",
      url: "/transactions",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        accountId: acc.id,
        categoryId: transferCategory.id,
        type: "income",
        amount: 250,
        date: "2025-01-10",
        description: "Transferência recebida",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.categoryId).toBe(transferCategory.id);
    expect(body.type).toBe("income");
  });

  it("deve materializar ocorrência inicial em recorrência com revisão", async () => {
    const { token, user } = await registerAndLogin(app, db);

    const [acc] = await db
      .insert(accounts)
      .values({ name: "Carteira", type: "cash", userId: user.id, initialBalance: "0" })
      .returning();

    const [cat] = await db
      .insert(categories)
      .values({ name: "Assinaturas", type: "expense", userId: user.id })
      .returning();

    const res = await app.inject({
      method: "POST",
      url: "/transactions",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        accountId: acc.id,
        categoryId: cat.id,
        type: "expense",
        amount: 120,
        date: "2025-01-10",
        description: "Assinatura",
        recurrence: {
          postingMode: "review_required",
          frequency: "monthly",
          dayOfMonth: 10,
          endType: "never",
        },
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.recurrenceId).toBeTruthy();

    const [recurrence] = await db
      .select({ postingMode: recurrences.postingMode })
      .from(recurrences)
      .where(eq(recurrences.id, body.recurrenceId));
    expect(recurrence?.postingMode).toBe("review_required");

    const [occurrence] = await db
      .select()
      .from(recurrenceOccurrences)
      .where(eq(recurrenceOccurrences.recurrenceId, body.recurrenceId));

    expect(occurrence?.status).toBe("materialized");
    expect(occurrence?.transactionId).toBe(body.id);
    expect(occurrence?.reviewPayload).toBeNull();
  });
});
