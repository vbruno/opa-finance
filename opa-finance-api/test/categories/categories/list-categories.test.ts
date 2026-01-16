// test/categories/list-categories.test.ts
import type { FastifyInstance } from "fastify";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { DB } from "../../../src/core/plugins/drizzle";
import { categories, users } from "../../../src/db/schema";
import { registerAndLogin } from "../../helpers/auth";
import { buildTestApp } from "../../setup";

let app: FastifyInstance;
let db: DB;

describe("GET /categories", () => {
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

  it("deve listar categorias do usuário autenticado", async () => {
    const { token: tokenA, user: userA } = await registerAndLogin(app, db, "userA@test.com");
    const { token: tokenB, user: userB } = await registerAndLogin(app, db, "userB@test.com");

    // categoria de user A
    await app.inject({
      method: "POST",
      url: "/categories",
      headers: { Authorization: `Bearer ${tokenA}` },
      payload: { name: "Salário", type: "income" },
    });

    // categoria de user B
    await app.inject({
      method: "POST",
      url: "/categories",
      headers: { Authorization: `Bearer ${tokenB}` },
      payload: { name: "Alimentação", type: "expense" },
    });

    const resA = await app.inject({
      method: "GET",
      url: "/categories",
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    expect(resA.statusCode).toBe(200);
    expect(resA.json().length).toBe(1);
    expect(resA.json()[0].userId).toBe(userA.id);

    const resB = await app.inject({
      method: "GET",
      url: "/categories",
      headers: { Authorization: `Bearer ${tokenB}` },
    });

    expect(resB.json().length).toBe(1);
    expect(resB.json()[0].userId).toBe(userB.id);
  });

  it("deve retornar 401 sem token", async () => {
    const res = await app.inject({ method: "GET", url: "/categories" });
    expect(res.statusCode).toBe(401);
  });
});
