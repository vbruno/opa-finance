import type { FastifyInstance } from "fastify";
import { describe, it, beforeEach, afterEach, expect } from "vitest";
import type { DB } from "../../../src/core/plugins/drizzle";
import { categories, subcategories, users } from "../../../src/db/schema";
import { registerAndLogin } from "../../helpers/auth";
import { buildTestApp } from "../../setup";

let app: FastifyInstance;
let db: DB;

describe("PUT /subcategories/:id", () => {
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

  it("deve atualizar subcategoria com sucesso", async () => {
    const { token, user } = await registerAndLogin(app, db);

    const [category] = await db
      .insert(categories)
      .values({
        name: "Casa",
        type: "expense",
        userId: user.id,
      })
      .returning();

    const [sub] = await db
      .insert(subcategories)
      .values({
        name: "Luz",
        categoryId: category.id,
        userId: user.id,
        color: null,
      })
      .returning();

    const res = await app.inject({
      method: "PUT",
      url: `/subcategories/${sub.id}`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { name: "Energia" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe("Energia");
  });

  it("deve retornar 404 ao atualizar subcategoria inexistente", async () => {
    const { token } = await registerAndLogin(app, db);

    const res = await app.inject({
      method: "PUT",
      url: `/subcategories/00000000-0000-0000-0000-000000000000`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { name: "Teste" },
    });

    expect(res.statusCode).toBe(404);
  });

  it("deve retornar 403 ao atualizar subcategoria de outro usuário", async () => {
    const { token: tokenA } = await registerAndLogin(app, db, "a@test.com");
    const { user: userB } = await registerAndLogin(app, db, "b@test.com");

    const [category] = await db
      .insert(categories)
      .values({
        name: "Pets",
        type: "expense",
        userId: userB.id,
      })
      .returning();

    const [sub] = await db
      .insert(subcategories)
      .values({
        name: "Veterinário",
        categoryId: category.id,
        userId: userB.id,
        color: null,
      })
      .returning();

    const res = await app.inject({
      method: "PUT",
      url: `/subcategories/${sub.id}`,
      headers: { Authorization: `Bearer ${tokenA}` },
      payload: { name: "Hack" },
    });

    expect(res.statusCode).toBe(403);
  });

  it("deve retornar 400 se payload estiver vazio", async () => {
    const { token, user } = await registerAndLogin(app, db);

    const [category] = await db
      .insert(categories)
      .values({
        name: "Educação",
        type: "expense",
        userId: user.id,
      })
      .returning();

    const [sub] = await db
      .insert(subcategories)
      .values({
        name: "Cursos",
        categoryId: category.id,
        userId: user.id,
        color: null,
      })
      .returning();

    const res = await app.inject({
      method: "PUT",
      url: `/subcategories/${sub.id}`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {},
    });

    expect(res.statusCode).toBe(400);
  });
});
