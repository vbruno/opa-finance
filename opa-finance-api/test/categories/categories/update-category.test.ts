// test/categories/update-category.test.ts
import type { FastifyInstance } from "fastify";
import { describe, it, beforeEach, afterEach, expect } from "vitest";
import { registerAndLogin } from "../../helpers/auth";
import { buildTestApp } from "../../setup";
import type { DB } from "@/core/plugins/drizzle";
import { categories, users } from "@/db/schema";

let app: FastifyInstance;
let db: DB;

describe("PUT /categories/:id", () => {
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

  it("deve atualizar categoria com sucesso", async () => {
    const { token } = await registerAndLogin(app, db);

    const created = await app.inject({
      method: "POST",
      url: "/categories",
      headers: { Authorization: `Bearer ${token}` },
      payload: { name: "Antigo", type: "income" },
    });

    const category = created.json();

    const res = await app.inject({
      method: "PUT",
      url: `/categories/${category.id}`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { name: "Novo Nome" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe("Novo Nome");
  });

  it("deve retornar 404 para id inexistente", async () => {
    const { token } = await registerAndLogin(app, db);

    const res = await app.inject({
      method: "PUT",
      url: "/categories/00000000-0000-0000-0000-000000000000",
      headers: { Authorization: `Bearer ${token}` },
      payload: { name: "Teste" },
    });

    expect(res.statusCode).toBe(404);
  });

  it("deve retornar 403 ao atualizar categoria de outro usuário", async () => {
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
      method: "PUT",
      url: `/categories/${category.id}`,
      headers: { Authorization: `Bearer ${tokenB}` },
      payload: { name: "Tentativa inválida" },
    });

    expect(res.statusCode).toBe(403);
  });

  it("deve retornar 400 para body vazio", async () => {
    const { token } = await registerAndLogin(app, db);

    const created = await app.inject({
      method: "POST",
      url: "/categories",
      headers: { Authorization: `Bearer ${token}` },
      payload: { name: "Teste", type: "expense" },
    });

    const category = created.json();

    const res = await app.inject({
      method: "PUT",
      url: `/categories/${category.id}`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {},
    });

    expect(res.statusCode).toBe(400);
  });
});
