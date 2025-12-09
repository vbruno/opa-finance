// test/categories/delete-category.test.ts
import type { FastifyInstance } from "fastify";
import { describe, it, beforeEach, afterEach, expect } from "vitest";
import { registerAndLogin } from "../../helpers/auth";
import { buildTestApp } from "../../setup";
import type { DB } from "@/core/plugins/drizzle";
import { categories, subcategories, users } from "@/db/schema";

let app: FastifyInstance;
let db: DB;

describe("DELETE /categories/:id", () => {
  beforeEach(async () => {
    const built = await buildTestApp();
    app = built.app;
    db = built.db;

    await db.delete(subcategories);
    await db.delete(categories);
    await db.delete(users);
  });

  afterEach(async () => {
    await app.close();
  });

  it("deve remover categoria sem subcategorias", async () => {
    const { token } = await registerAndLogin(app, db);

    const created = await app.inject({
      method: "POST",
      url: "/categories",
      headers: { Authorization: `Bearer ${token}` },
      payload: { name: "Apagar", type: "expense" },
    });

    const category = created.json();

    const res = await app.inject({
      method: "DELETE",
      url: `/categories/${category.id}`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().message).toBe("Categoria removida com sucesso.");
  });

  // test/categories/delete-category.test.ts
  // (...mesmo código...)

  it("não deve remover categoria com subcategorias (409)", async () => {
    const { token } = await registerAndLogin(app, db); // <-- CORRETO

    const created = await app.inject({
      method: "POST",
      url: "/categories",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      payload: { name: "Saúde", type: "expense" },
    });

    const category = created.json();

    await app.inject({
      method: "POST",
      url: "/subcategories",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      payload: { categoryId: category.id, name: "Medicamentos" },
    });

    const response = await app.inject({
      method: "DELETE",
      url: `/categories/${category.id}`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(409);

    const body = response.json();
    expect(body.detail).toContain("subcategorias");
  });

  it("deve retornar 404 ao remover categoria inexistente", async () => {
    const { token } = await registerAndLogin(app, db);

    const res = await app.inject({
      method: "DELETE",
      url: `/categories/00000000-0000-0000-0000-000000000000`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it("deve retornar 403 ao remover categoria de outro usuário", async () => {
    const { token: tokenA } = await registerAndLogin(app, db, "a@test.com");
    const { token: tokenB } = await registerAndLogin(app, db, "b@test.com");

    const created = await app.inject({
      method: "POST",
      url: "/categories",
      headers: { Authorization: `Bearer ${tokenA}` },
      payload: { name: "Categoria A", type: "income" },
    });

    const category = created.json();

    const res = await app.inject({
      method: "DELETE",
      url: `/categories/${category.id}`,
      headers: { Authorization: `Bearer ${tokenB}` },
    });

    expect(res.statusCode).toBe(403);
  });
});
