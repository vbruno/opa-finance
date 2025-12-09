// test/subcategories/create-subcategory.test.ts
import type { FastifyInstance } from "fastify";
import { describe, it, beforeEach, afterEach, expect } from "vitest";
import { registerAndLogin } from "../../helpers/auth";
import { buildTestApp } from "../../setup";
import type { DB } from "@/core/plugins/drizzle";

import { categories, subcategories, users } from "@/db/schema";

let app: FastifyInstance;
let db: DB;

describe("POST /subcategories", () => {
  beforeEach(async () => {
    const built = await buildTestApp();
    app = built.app;
    db = built.db;

    // limpa tabelas relacionadas
    await db.delete(subcategories);
    await db.delete(categories);
    await db.delete(users);
  });

  afterEach(async () => {
    await app.close();
  });

  it("deve criar subcategoria com sucesso", async () => {
    const { token, user } = await registerAndLogin(app, db);

    const [category] = await db
      .insert(categories)
      .values({
        name: "Alimentação",
        type: "expense",
        userId: user.id,
      })
      .returning();

    const res = await app.inject({
      method: "POST",
      url: "/subcategories",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      payload: {
        categoryId: category.id,
        name: "Restaurantes",
        color: "#FF0000",
      },
    });

    expect(res.statusCode).toBe(201);

    const body = res.json();
    expect(body).toMatchObject({
      name: "Restaurantes",
      categoryId: category.id,
      userId: user.id,
    });
  });

  it("deve retornar 400 com payload inválido", async () => {
    const { token, user } = await registerAndLogin(app, db);

    const [category] = await db
      .insert(categories)
      .values({
        name: "Transporte",
        type: "expense",
        userId: user.id,
      })
      .returning();

    const res = await app.inject({
      method: "POST",
      url: "/subcategories",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      payload: {
        categoryId: category.id,
        name: "",
      },
    });

    expect(res.statusCode).toBe(400);

    const body = res.json();
    // Se quiser ser mais específico:
    expect(body.title).toBe("Validation Error");
    expect(body.status).toBe(400);
  });

  it("deve retornar 401 se não enviar token", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/subcategories",
      payload: {
        categoryId: "00000000-0000-0000-0000-000000000000",
        name: "Teste",
      },
    });

    expect(res.statusCode).toBe(401);
  });
});
