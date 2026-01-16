// test/categories/get-category.test.ts
import type { FastifyInstance } from "fastify";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { DB } from "../../../src/core/plugins/drizzle";
import { categories, users } from "../../../src/db/schema";
import { registerAndLogin } from "../../helpers/auth";
import { buildTestApp } from "../../setup";

let app: FastifyInstance;
let db: DB;

describe("GET /categories/:id", () => {
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

  it("deve retornar categoria existente", async () => {
    const { token, user } = await registerAndLogin(app, db);

    const created = await app.inject({
      method: "POST",
      url: "/categories",
      headers: { Authorization: `Bearer ${token}` },
      payload: { name: "Transporte", type: "expense" },
    });

    const category = created.json();

    const res = await app.inject({
      method: "GET",
      url: `/categories/${category.id}`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      id: category.id,
      name: "Transporte",
      type: "expense",
      userId: user.id,
    });
  });

  it("deve retornar 404 para id inexistente", async () => {
    const { token } = await registerAndLogin(app, db);

    const res = await app.inject({
      method: "GET",
      url: "/categories/00000000-0000-0000-0000-000000000000",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it("deve retornar 403 ao acessar categoria de outro usuário", async () => {
    const { token: tokenA } = await registerAndLogin(app, db, "a@test.com");
    const { token: tokenB } = await registerAndLogin(app, db, "b@test.com");

    const created = await app.inject({
      method: "POST",
      url: "/categories",
      headers: { Authorization: `Bearer ${tokenA}` },
      payload: { name: "Saúde", type: "expense" },
    });

    const category = created.json();

    const res = await app.inject({
      method: "GET",
      url: `/categories/${category.id}`,
      headers: { Authorization: `Bearer ${tokenB}` },
    });

    expect(res.statusCode).toBe(403);
  });
});
