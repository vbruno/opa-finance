import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DB } from "../../src/core/plugins/drizzle";
import { auditLogs } from "../../src/db/schema";
import { registerAndLogin } from "../helpers/auth";
import { buildTestApp } from "../setup";

let app: FastifyInstance;
let db: DB;

describe("GET /audit-logs", () => {
  beforeEach(async () => {
    const built = await buildTestApp();
    app = built.app;
    db = built.db;
  });

  afterEach(async () => {
    await app?.close();
  });

  it("deve listar apenas logs do usuario autenticado", async () => {
    const { token: tokenUserA, user: userA } = await registerAndLogin(
      app,
      db,
      "audit-a@test.com",
      "Audit User A",
    );
    const { user: userB } = await registerAndLogin(app, db, "audit-b@test.com", "Audit User B");

    await db.insert(auditLogs).values([
      {
        userId: userA.id,
        entityType: "transaction",
        entityId: crypto.randomUUID(),
        action: "create",
        afterData: { amount: 100, description: "A1" },
        createdAt: new Date("2026-03-01T10:00:00.000Z"),
      },
      {
        userId: userA.id,
        entityType: "account",
        entityId: crypto.randomUUID(),
        action: "update",
        beforeData: { name: "Conta antiga" },
        afterData: { name: "Conta nova" },
        createdAt: new Date("2026-03-02T10:00:00.000Z"),
      },
      {
        userId: userB.id,
        entityType: "category",
        entityId: crypto.randomUUID(),
        action: "delete",
        beforeData: { name: "Categoria B" },
        createdAt: new Date("2026-03-03T10:00:00.000Z"),
      },
    ]);

    const res = await app.inject({
      method: "GET",
      url: "/audit-logs?page=1&limit=10",
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.total).toBe(2);
    expect(body.data).toHaveLength(2);
    expect(body.data.every((row: (typeof body.data)[number]) => row.userId === userA.id)).toBe(
      true,
    );
  });

  it("deve aplicar filtros por entidade, acao e periodo com paginacao", async () => {
    const { token, user } = await registerAndLogin(
      app,
      db,
      "audit-filter@test.com",
      "Audit Filter",
    );

    await db.insert(auditLogs).values([
      {
        userId: user.id,
        entityType: "transaction",
        entityId: crypto.randomUUID(),
        action: "update",
        beforeData: { amount: 50 },
        afterData: { amount: 60 },
        createdAt: new Date("2026-03-10T01:00:00.000Z"),
      },
      {
        userId: user.id,
        entityType: "transaction",
        entityId: crypto.randomUUID(),
        action: "update",
        beforeData: { amount: 60 },
        afterData: { amount: 70 },
        createdAt: new Date("2026-03-10T02:00:00.000Z"),
      },
      {
        userId: user.id,
        entityType: "account",
        entityId: crypto.randomUUID(),
        action: "update",
        beforeData: { name: "Conta A" },
        afterData: { name: "Conta B" },
        createdAt: new Date("2026-03-10T03:00:00.000Z"),
      },
    ]);

    const res = await app.inject({
      method: "GET",
      url: "/audit-logs?page=1&limit=1&entityType=transaction&action=update&startDate=2026-03-10&endDate=2026-03-10",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.total).toBe(2);
    expect(body.data).toHaveLength(1);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(1);
    expect(body.data[0].entityType).toBe("transaction");
    expect(body.data[0].action).toBe("update");
  });

  it("deve bloquear acesso a logs de outro usuario mesmo com filtros direcionados", async () => {
    const { token: tokenUserA, user: userA } = await registerAndLogin(
      app,
      db,
      "audit-sec-a@test.com",
      "Audit Security A",
    );
    const { user: userB } = await registerAndLogin(
      app,
      db,
      "audit-sec-b@test.com",
      "Audit Security B",
    );

    const entityIdB = crypto.randomUUID();
    await db.insert(auditLogs).values({
      userId: userB.id,
      entityType: "transaction",
      entityId: entityIdB,
      action: "delete",
      beforeData: { description: "Somente B" },
      createdAt: new Date("2026-03-11T10:00:00.000Z"),
    });

    await db.insert(auditLogs).values({
      userId: userA.id,
      entityType: "transaction",
      entityId: crypto.randomUUID(),
      action: "create",
      afterData: { description: "Somente A" },
      createdAt: new Date("2026-03-11T09:00:00.000Z"),
    });

    const res = await app.inject({
      method: "GET",
      url: `/audit-logs?entityType=transaction&action=delete&startDate=2026-03-11&endDate=2026-03-11`,
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBe(0);
    expect(body.data).toHaveLength(0);
    expect(body.data.every((row: (typeof body.data)[number]) => row.userId === userA.id)).toBe(
      true,
    );
  });

  it("deve suportar combinacoes de filtros e retornar pagina vazia quando offset excede total", async () => {
    const { token, user } = await registerAndLogin(app, db, "audit-combo@test.com", "Audit Combo");

    await db.insert(auditLogs).values([
      {
        userId: user.id,
        entityType: "category",
        entityId: crypto.randomUUID(),
        action: "update",
        beforeData: { name: "A" },
        afterData: { name: "B" },
        createdAt: new Date("2026-03-12T10:00:00.000Z"),
      },
      {
        userId: user.id,
        entityType: "category",
        entityId: crypto.randomUUID(),
        action: "update",
        beforeData: { name: "B" },
        afterData: { name: "C" },
        createdAt: new Date("2026-03-12T11:00:00.000Z"),
      },
      {
        userId: user.id,
        entityType: "category",
        entityId: crypto.randomUUID(),
        action: "create",
        afterData: { name: "D" },
        createdAt: new Date("2026-03-12T12:00:00.000Z"),
      },
    ]);

    const filteredRes = await app.inject({
      method: "GET",
      url: "/audit-logs?entityType=category&action=update&startDate=2026-03-12&endDate=2026-03-12&page=1&limit=10",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(filteredRes.statusCode).toBe(200);
    const filteredBody = filteredRes.json();
    expect(filteredBody.total).toBe(2);
    expect(filteredBody.data).toHaveLength(2);
    expect(
      filteredBody.data.every(
        (row: (typeof filteredBody.data)[number]) =>
          row.entityType === "category" && row.action === "update",
      ),
    ).toBe(true);

    const emptyPageRes = await app.inject({
      method: "GET",
      url: "/audit-logs?entityType=category&action=update&startDate=2026-03-12&endDate=2026-03-12&page=3&limit=1",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(emptyPageRes.statusCode).toBe(200);
    const emptyPageBody = emptyPageRes.json();
    expect(emptyPageBody.total).toBe(2);
    expect(emptyPageBody.data).toHaveLength(0);
  });

  it("deve respeitar limites extremos de paginacao (min e max) e validar acima do maximo", async () => {
    const { token, user } = await registerAndLogin(
      app,
      db,
      "audit-limits@test.com",
      "Audit Limits",
    );

    await db.insert(auditLogs).values({
      userId: user.id,
      entityType: "account",
      entityId: crypto.randomUUID(),
      action: "create",
      afterData: { name: "Conta Limite" },
      createdAt: new Date("2026-03-13T10:00:00.000Z"),
    });

    const minLimitRes = await app.inject({
      method: "GET",
      url: "/audit-logs?page=1&limit=1",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(minLimitRes.statusCode).toBe(200);
    expect(minLimitRes.json().limit).toBe(1);

    const maxLimitRes = await app.inject({
      method: "GET",
      url: "/audit-logs?page=1&limit=100",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(maxLimitRes.statusCode).toBe(200);
    expect(maxLimitRes.json().limit).toBe(100);

    const aboveMaxRes = await app.inject({
      method: "GET",
      url: "/audit-logs?page=1&limit=101",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(aboveMaxRes.statusCode).toBe(400);
  });

  it("deve agrupar pares de transferencia quando view=grouped", async () => {
    const { token, user } = await registerAndLogin(
      app,
      db,
      "audit-grouped@test.com",
      "Audit Grouped",
    );

    const transferId = crypto.randomUUID();

    await db.insert(auditLogs).values([
      {
        userId: user.id,
        entityType: "transaction",
        entityId: crypto.randomUUID(),
        action: "create",
        afterData: { amount: 100, accountId: crypto.randomUUID() },
        metadata: { operation: "transfer-create", transferId, side: "fromAccount" },
        createdAt: new Date("2026-03-15T10:00:00.000Z"),
      },
      {
        userId: user.id,
        entityType: "transaction",
        entityId: crypto.randomUUID(),
        action: "create",
        afterData: { amount: 100, accountId: crypto.randomUUID() },
        metadata: { operation: "transfer-create", transferId, side: "toAccount" },
        createdAt: new Date("2026-03-15T10:00:01.000Z"),
      },
      {
        userId: user.id,
        entityType: "account",
        entityId: crypto.randomUUID(),
        action: "update",
        beforeData: { name: "Conta A" },
        afterData: { name: "Conta B" },
        createdAt: new Date("2026-03-15T11:00:00.000Z"),
      },
    ]);

    const groupedRes = await app.inject({
      method: "GET",
      url: "/audit-logs?view=grouped&page=1&limit=10",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(groupedRes.statusCode).toBe(200);
    const groupedBody = groupedRes.json();
    expect(groupedBody.total).toBe(2);
    expect(groupedBody.data).toHaveLength(2);

    const groupedTransfer = groupedBody.data.find(
      (row: (typeof groupedBody.data)[number]) =>
        row.metadata?.operation === "transfer-create" && row.metadata?.transferId === transferId,
    );
    expect(groupedTransfer).toBeDefined();
    expect(groupedTransfer.metadata?.grouped).toBe(true);
    expect(groupedTransfer.metadata?.groupSize).toBe(2);
  });

  it("deve retornar 400 quando startDate for maior que endDate", async () => {
    const { token } = await registerAndLogin(app, db, "audit-date@test.com", "Audit Date");

    const res = await app.inject({
      method: "GET",
      url: "/audit-logs?startDate=2026-03-20&endDate=2026-03-10",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(400);
  });

  it("deve retornar 401 sem token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/audit-logs",
    });

    expect(res.statusCode).toBe(401);
  });
});
