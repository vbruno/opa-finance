import type { FastifyInstance } from "fastify";
import { describe, it, beforeEach, afterEach, expect } from "vitest";
import { registerAndLogin } from "../../helpers/auth";
import { buildTestApp } from "../../setup";
import type { DB } from "@/core/plugins/drizzle";
import { categories, subcategories, users } from "@/db/schema";

let app: FastifyInstance;
let db: DB;

describe("DELETE /subcategories/:id", () => {
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

  it("deve remover subcategoria com sucesso", async () => {
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
        name: "Água",
        categoryId: category.id,
        userId: user.id,
        color: null,
      })
      .returning();

    const res = await app.inject({
      method: "DELETE",
      url: `/subcategories/${sub.id}`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().message).toBe("Subcategoria removida com sucesso.");
  });

  it("deve retornar 404 ao deletar subcategoria inexistente", async () => {
    const { token } = await registerAndLogin(app, db);

    const res = await app.inject({
      method: "DELETE",
      url: `/subcategories/00000000-0000-0000-0000-000000000000`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it("deve retornar 403 ao deletar subcategoria de outro usuário", async () => {
    const { token: tokenA } = await registerAndLogin(app, db, "userA@test.com");
    const { user: userB } = await registerAndLogin(app, db, "userB@test.com");

    const [category] = await db
      .insert(categories)
      .values({
        name: "Outros",
        type: "expense",
        userId: userB.id,
      })
      .returning();

    const [sub] = await db
      .insert(subcategories)
      .values({
        name: "Teste",
        categoryId: category.id,
        userId: userB.id,
        color: null,
      })
      .returning();

    const res = await app.inject({
      method: "DELETE",
      url: `/subcategories/${sub.id}`,
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    expect(res.statusCode).toBe(403);
  });
});
