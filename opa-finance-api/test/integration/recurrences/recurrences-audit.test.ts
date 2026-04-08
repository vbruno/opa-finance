import { and, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { auditLogs } from "@/db/schema";
import { registerAndLogin } from "../helpers/auth";
import { resetTables } from "../helpers/resetTables";
import { buildTestApp } from "../setup";

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
});
