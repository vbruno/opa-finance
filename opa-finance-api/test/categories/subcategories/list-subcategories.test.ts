import type { FastifyInstance } from "fastify";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { registerAndLogin } from "../../helpers/auth";
import { buildTestApp } from "../../setup";
import type { DB } from "@/core/plugins/drizzle";
import { categories, subcategories, users } from "@/db/schema";

let app: FastifyInstance;
let db: DB;

describe("GET /categories/:id/subcategories", () => {
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

  it("deve listar subcategorias da categoria", async () => {
    const { token, user } = await registerAndLogin(app, db);

    const [category] = await db
      .insert(categories)
      .values({ name: "Moradia", type: "expense", userId: user.id })
      .returning();

    await db.insert(subcategories).values([
      { name: "Aluguel", categoryId: category.id, color: null, userId: user.id },
      { name: "Condomínio", categoryId: category.id, color: null, userId: user.id },
    ]);

    const response = await app.inject({
      method: "GET",
      url: `/categories/${category.id}/subcategories`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const list = response.json();
    expect(list.length).toBe(2);
  });

  it("deve retornar 404 se categoria não existir", async () => {
    const { token } = await registerAndLogin(app, db);

    const response = await app.inject({
      method: "GET",
      url: `/categories/00000000-0000-0000-0000-000000000000/subcategories`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(404);
  });

  it("deve retornar 403 ao acessar categoria de outro usuário", async () => {
    const { token: tokenA } = await registerAndLogin(app, db, "a@test.com");
    const { user: userB } = await registerAndLogin(app, db, "b@test.com");

    const [category] = await db
      .insert(categories)
      .values({ name: "Viagem", type: "expense", userId: userB.id })
      .returning();

    const response = await app.inject({
      method: "GET",
      url: `/categories/${category.id}/subcategories`,
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    expect(response.statusCode).toBe(403);
  });
});
