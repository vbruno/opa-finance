import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DB } from "../../src/core/plugins/drizzle";
import { auditLogs } from "../../src/db/schema";
import { registerAndLogin } from "../helpers/auth";
import { buildTestApp } from "../setup";

let app: FastifyInstance;
let db: DB;

describe("Audit write integration", () => {
  beforeEach(async () => {
    const built = await buildTestApp();
    app = built.app;
    db = built.db;
  });

  afterEach(async () => {
    await app?.close();
  });

  it("deve registrar log de create ao criar conta", async () => {
    const { token, user } = await registerAndLogin(
      app,
      db,
      "audit-create@test.com",
      "Audit Create",
    );

    const createResponse = await app.inject({
      method: "POST",
      url: "/accounts",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      payload: {
        name: "Conta Auditoria",
        type: "cash",
      },
    });

    expect(createResponse.statusCode).toBe(201);
    const account = createResponse.json();

    const logs = await db.select().from(auditLogs).where(eq(auditLogs.entityId, account.id));

    expect(logs).toHaveLength(1);
    expect(logs[0].userId).toBe(user.id);
    expect(logs[0].entityType).toBe("account");
    expect(logs[0].action).toBe("create");
    expect((logs[0].afterData as { name?: string } | null)?.name).toBe("Conta Auditoria");
  });

  it("deve registrar log de update ao atualizar conta", async () => {
    const { token } = await registerAndLogin(app, db, "audit-update@test.com", "Audit Update");

    const createResponse = await app.inject({
      method: "POST",
      url: "/accounts",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      payload: {
        name: "Conta Antes",
        type: "cash",
      },
    });

    const account = createResponse.json();

    const updateResponse = await app.inject({
      method: "PUT",
      url: `/accounts/${account.id}`,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      payload: {
        name: "Conta Depois",
      },
    });

    expect(updateResponse.statusCode).toBe(200);

    const logs = await db.select().from(auditLogs).where(eq(auditLogs.entityId, account.id));
    const updateLog = logs.find((log: (typeof logs)[number]) => log.action === "update");

    expect(updateLog).toBeDefined();
    expect((updateLog?.beforeData as { name?: string } | null)?.name).toBe("Conta Antes");
    expect((updateLog?.afterData as { name?: string } | null)?.name).toBe("Conta Depois");
  });

  it("deve registrar log de delete ao remover conta nao principal", async () => {
    const { token } = await registerAndLogin(app, db, "audit-delete@test.com", "Audit Delete");

    const primary = await app.inject({
      method: "POST",
      url: "/accounts",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      payload: {
        name: "Conta Principal",
        type: "cash",
      },
    });

    expect(primary.statusCode).toBe(201);

    const secondary = await app.inject({
      method: "POST",
      url: "/accounts",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      payload: {
        name: "Conta Secundaria",
        type: "checking_account",
      },
    });

    expect(secondary.statusCode).toBe(201);
    const secondaryAccount = secondary.json();

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: `/accounts/${secondaryAccount.id}`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(deleteResponse.statusCode).toBe(200);

    const logs = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.entityId, secondaryAccount.id));
    const deleteLog = logs.find((log: (typeof logs)[number]) => log.action === "delete");

    expect(deleteLog).toBeDefined();
    expect((deleteLog?.beforeData as { name?: string } | null)?.name).toBe("Conta Secundaria");
    expect(deleteLog?.afterData).toBeNull();
  });

  it("deve registrar logs de create, update e delete para transacao", async () => {
    const { token } = await registerAndLogin(app, db, "audit-tx@test.com", "Audit Tx");

    const accountResponse = await app.inject({
      method: "POST",
      url: "/accounts",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      payload: {
        name: "Conta Transacao",
        type: "cash",
      },
    });
    expect(accountResponse.statusCode).toBe(201);
    const account = accountResponse.json();

    const categoryResponse = await app.inject({
      method: "POST",
      url: "/categories",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      payload: {
        name: "Categoria Tx",
        type: "expense",
      },
    });
    expect(categoryResponse.statusCode).toBe(201);
    const category = categoryResponse.json();

    const createTxResponse = await app.inject({
      method: "POST",
      url: "/transactions",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      payload: {
        accountId: account.id,
        categoryId: category.id,
        type: "expense",
        amount: 100,
        date: "2026-03-10",
        description: "Compra inicial",
      },
    });
    expect(createTxResponse.statusCode).toBe(201);
    const transaction = createTxResponse.json();

    const updateTxResponse = await app.inject({
      method: "PUT",
      url: `/transactions/${transaction.id}`,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      payload: {
        amount: 150,
        description: "Compra ajustada",
      },
    });
    expect(updateTxResponse.statusCode).toBe(200);

    const deleteTxResponse = await app.inject({
      method: "DELETE",
      url: `/transactions/${transaction.id}`,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    expect(deleteTxResponse.statusCode).toBe(200);

    const logs = await db.select().from(auditLogs).where(eq(auditLogs.entityId, transaction.id));
    const createLog = logs.find((log: (typeof logs)[number]) => log.action === "create");
    const updateLog = logs.find((log: (typeof logs)[number]) => log.action === "update");
    const deleteLog = logs.find((log: (typeof logs)[number]) => log.action === "delete");

    expect(createLog).toBeDefined();
    expect(updateLog).toBeDefined();
    expect(deleteLog).toBeDefined();
    expect((updateLog?.beforeData as { amount?: number } | null)?.amount).toBe(100);
    expect((updateLog?.afterData as { amount?: number } | null)?.amount).toBe(150);
  });

  it("deve registrar logs de create, update e delete para categoria", async () => {
    const { token } = await registerAndLogin(app, db, "audit-category@test.com", "Audit Category");

    const createResponse = await app.inject({
      method: "POST",
      url: "/categories",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      payload: {
        name: "Categoria Inicial",
        type: "expense",
      },
    });
    expect(createResponse.statusCode).toBe(201);
    const category = createResponse.json();

    const updateResponse = await app.inject({
      method: "PUT",
      url: `/categories/${category.id}`,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      payload: {
        name: "Categoria Atualizada",
      },
    });
    expect(updateResponse.statusCode).toBe(200);

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: `/categories/${category.id}`,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    expect(deleteResponse.statusCode).toBe(200);

    const logs = await db.select().from(auditLogs).where(eq(auditLogs.entityId, category.id));
    const createLog = logs.find((log: (typeof logs)[number]) => log.action === "create");
    const updateLog = logs.find((log: (typeof logs)[number]) => log.action === "update");
    const deleteLog = logs.find((log: (typeof logs)[number]) => log.action === "delete");

    expect(createLog).toBeDefined();
    expect(updateLog).toBeDefined();
    expect(deleteLog).toBeDefined();
    expect((updateLog?.beforeData as { name?: string } | null)?.name).toBe("Categoria Inicial");
    expect((updateLog?.afterData as { name?: string } | null)?.name).toBe("Categoria Atualizada");
  });

  it("deve registrar logs de create, update e delete para subcategoria", async () => {
    const { token } = await registerAndLogin(app, db, "audit-subcat@test.com", "Audit Subcategory");

    const categoryResponse = await app.inject({
      method: "POST",
      url: "/categories",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      payload: {
        name: "Categoria Sub",
        type: "expense",
      },
    });
    expect(categoryResponse.statusCode).toBe(201);
    const category = categoryResponse.json();

    const createResponse = await app.inject({
      method: "POST",
      url: "/subcategories",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      payload: {
        categoryId: category.id,
        name: "Subcategoria Inicial",
      },
    });
    expect(createResponse.statusCode).toBe(201);
    const subcategory = createResponse.json();

    const updateResponse = await app.inject({
      method: "PUT",
      url: `/subcategories/${subcategory.id}`,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      payload: {
        name: "Subcategoria Atualizada",
      },
    });
    expect(updateResponse.statusCode).toBe(200);

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: `/subcategories/${subcategory.id}`,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    expect(deleteResponse.statusCode).toBe(200);

    const logs = await db.select().from(auditLogs).where(eq(auditLogs.entityId, subcategory.id));
    const createLog = logs.find((log: (typeof logs)[number]) => log.action === "create");
    const updateLog = logs.find((log: (typeof logs)[number]) => log.action === "update");
    const deleteLog = logs.find((log: (typeof logs)[number]) => log.action === "delete");

    expect(createLog).toBeDefined();
    expect(updateLog).toBeDefined();
    expect(deleteLog).toBeDefined();
    expect((updateLog?.beforeData as { name?: string } | null)?.name).toBe("Subcategoria Inicial");
    expect((updateLog?.afterData as { name?: string } | null)?.name).toBe(
      "Subcategoria Atualizada",
    );
  });
});
