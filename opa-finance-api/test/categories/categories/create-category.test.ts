// test/categories/create-category.test.ts
import type { FastifyInstance } from "fastify";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { DB } from "../../../src/core/plugins/drizzle";
import { categories, users } from "../../../src/db/schema";
import { registerAndLogin } from "../../helpers/auth";
import { buildTestApp } from "../../setup";

let app: FastifyInstance;
let db: DB;

describe("POST /categories", () => {
  beforeEach(async () => {
    const built = await buildTestApp();
    app = built.app;
    db = built.db;

    await db.delete(categories);
    await db.delete(users);
  });

  afterEach(async () => {
    await app.close();
  });

  it("deve criar categoria com sucesso", async () => {
    const { token, user } = await registerAndLogin(app, db);

    const res = await app.inject({
      method: "POST",
      url: "/categories",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      payload: { name: "Alimentação", type: "expense" },
    });

    expect(res.statusCode).toBe(201);

    const body = res.json();
    expect(body).toMatchObject({
      name: "Alimentação",
      type: "expense",
      userId: user.id,
    });
  });

  it("deve retornar 400 para payload inválido", async () => {
    const { token } = await registerAndLogin(app, db);

    const res = await app.inject({
      method: "POST",
      url: "/categories",
      headers: { Authorization: `Bearer ${token}` },
      payload: { type: "income" }, // falta name
    });

    expect(res.statusCode).toBe(400);
  });

  it("deve retornar 401 ao criar sem token", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/categories",
      payload: { name: "Teste", type: "expense" },
    });

    expect(res.statusCode).toBe(401);
  });
});
