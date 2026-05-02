import { and, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { registerAndLogin } from "../helpers/auth";
import { resetTables } from "../helpers/resetTables";
import { buildTestApp } from "../setup";
import { auditLogs, recurrenceOccurrences } from "@/db/schema";

describe("Recurrences - audit trail", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    const built = await buildTestApp();
    app = built.app;
    await resetTables(built.db);
  });

  afterEach(async () => {
    await app?.close();
  });

  it("deve registrar create/update/materialize/finalize/delete para recorrência", async () => {
    const { token } = await registerAndLogin(
      app,
      app.db,
      `audit-rec-${crypto.randomUUID()}@test.com`,
    );

    const accountRes = await app.inject({
      method: "POST",
      url: "/accounts",
      headers: { Authorization: `Bearer ${token}` },
      payload: { name: "Conta Recorrência", type: "cash" },
    });
    expect(accountRes.statusCode).toBe(201);
    const account = accountRes.json();

    const categoryRes = await app.inject({
      method: "POST",
      url: "/categories",
      headers: { Authorization: `Bearer ${token}` },
      payload: { name: "Categoria Recorrência", type: "expense" },
    });
    expect(categoryRes.statusCode).toBe(201);
    const category = categoryRes.json();

    const createRes = await app.inject({
      method: "POST",
      url: "/recurrences",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        originType: "transaction",
        frequency: "weekly",
        startDate: "2099-01-06",
        dayOfWeek: 1,
        accountId: account.id,
        categoryId: category.id,
        amount: 120,
        description: "Recorrência audit",
      },
    });
    expect(createRes.statusCode).toBe(201);
    const recurrence = createRes.json();

    const updateRes = await app.inject({
      method: "PUT",
      url: `/recurrences/${recurrence.id}`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        amount: 150,
        expectedVersion: recurrence.version,
      },
    });
    expect(updateRes.statusCode).toBe(200);

    const materializeRes = await app.inject({
      method: "POST",
      url: "/recurrences/materialize",
      headers: { Authorization: `Bearer ${token}` },
      payload: { untilDate: "2099-01-20" },
    });
    expect(materializeRes.statusCode).toBe(200);
    expect(materializeRes.json().createdOccurrences).toBeGreaterThan(0);

    const finalizeRes = await app.inject({
      method: "PUT",
      url: `/recurrences/${recurrence.id}/finalize`,
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(finalizeRes.statusCode).toBe(200);

    const deleteRes = await app.inject({
      method: "DELETE",
      url: `/recurrences/${recurrence.id}`,
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(deleteRes.statusCode).toBe(200);

    const logs = await app.db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityType, "recurrence"), eq(auditLogs.entityId, recurrence.id)));

    expect(logs.length).toBeGreaterThanOrEqual(5);

    const operations = logs
      .map((log) => (log.metadata as { operation?: string } | null)?.operation)
      .filter((value): value is string => typeof value === "string");

    expect(operations).toContain("recurrence-create");
    expect(operations).toContain("recurrence-update");
    expect(operations).toContain("recurrence-materialize");
    expect(operations).toContain("recurrence-finalize");
    expect(operations).toContain("recurrence-delete");
  });

  it("deve registrar auditoria de pendência, confirmação e skip da ocorrência", async () => {
    const { token } = await registerAndLogin(
      app,
      app.db,
      `audit-occurrence-${crypto.randomUUID()}@test.com`,
    );

    const accountRes = await app.inject({
      method: "POST",
      url: "/accounts",
      headers: { Authorization: `Bearer ${token}` },
      payload: { name: "Conta Ocorrência", type: "cash" },
    });
    expect(accountRes.statusCode).toBe(201);
    const account = accountRes.json();

    const categoryRes = await app.inject({
      method: "POST",
      url: "/categories",
      headers: { Authorization: `Bearer ${token}` },
      payload: { name: "Categoria Ocorrência", type: "expense" },
    });
    expect(categoryRes.statusCode).toBe(201);
    const category = categoryRes.json();

    const createReviewRecurrence = async (description: string) => {
      const createRes = await app.inject({
        method: "POST",
        url: "/recurrences",
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          originType: "transaction",
          postingMode: "review_required",
          frequency: "weekly",
          startDate: "2026-05-04",
          dayOfWeek: 1,
          accountId: account.id,
          categoryId: category.id,
          amount: 120,
          description,
        },
      });
      expect(createRes.statusCode).toBe(201);
      return createRes.json();
    };

    const confirmRecurrence = await createReviewRecurrence("Recorrência audit confirm");
    const confirmMaterializeRes = await app.inject({
      method: "POST",
      url: "/recurrences/materialize",
      headers: { Authorization: `Bearer ${token}` },
      payload: { untilDate: "2026-05-18" },
    });
    expect(confirmMaterializeRes.statusCode).toBe(200);

    const [confirmPending] = await app.db
      .select()
      .from(recurrenceOccurrences)
      .where(
        and(
          eq(recurrenceOccurrences.recurrenceId, confirmRecurrence.id),
          eq(recurrenceOccurrences.status, "pending_review"),
        ),
      )
      .limit(1);
    expect(confirmPending).toBeDefined();

    const confirmOccurrenceLogs = await app.db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.entityType, "recurrence_occurrence"),
          eq(auditLogs.entityId, confirmPending!.id),
        ),
      );
    expect(confirmOccurrenceLogs.some((log) => log.action === "materialize_pending")).toBe(true);

    const confirmRes = await app.inject({
      method: "POST",
      url: `/recurrences/occurrences/${confirmPending!.id}/confirm`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        expectedVersion: confirmPending!.version,
      },
    });
    expect(confirmRes.statusCode).toBe(200);

    const confirmLogsAfter = await app.db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.entityType, "recurrence_occurrence"),
          eq(auditLogs.entityId, confirmPending!.id),
        ),
      );
    expect(confirmLogsAfter.some((log) => log.action === "confirm")).toBe(true);

    const skipRecurrence = await createReviewRecurrence("Recorrência audit skip");
    const skipMaterializeRes = await app.inject({
      method: "POST",
      url: "/recurrences/materialize",
      headers: { Authorization: `Bearer ${token}` },
      payload: { untilDate: "2026-05-18" },
    });
    expect(skipMaterializeRes.statusCode).toBe(200);

    const [skipPending] = await app.db
      .select()
      .from(recurrenceOccurrences)
      .where(
        and(
          eq(recurrenceOccurrences.recurrenceId, skipRecurrence.id),
          eq(recurrenceOccurrences.status, "pending_review"),
        ),
      )
      .limit(1);
    expect(skipPending).toBeDefined();

    const skipRes = await app.inject({
      method: "POST",
      url: `/recurrences/occurrences/${skipPending!.id}/skip`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        expectedVersion: skipPending!.version,
        reason: "Não aconteceu",
      },
    });
    expect(skipRes.statusCode).toBe(200);

    const skipLogs = await app.db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.entityType, "recurrence_occurrence"),
          eq(auditLogs.entityId, skipPending!.id),
        ),
      );

    expect(skipLogs.some((log) => log.action === "materialize_pending")).toBe(true);
    expect(skipLogs.some((log) => log.action === "skip")).toBe(true);
  });
});
