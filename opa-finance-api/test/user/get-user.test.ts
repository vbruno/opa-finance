import { eq } from "drizzle-orm";
import { FastifyInstance } from "fastify";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { DB } from "../../src/core/plugins/drizzle-test";
import { users } from "../../src/db/schema";
import { buildTestApp } from "../setup";

let app: FastifyInstance;
let db: DB;

describe("GET /users/:id", () => {
  beforeEach(async () => {
    const built = await buildTestApp();
    app = built.app;
    db = built.db;

    // limpar tabela
    await db.delete(users);
  });

  afterEach(async () => {
    await app.close();
  });

  it("deve retornar o usuário autenticado", async () => {
    // registra usuário
    const register = await app.inject({
      method: "POST",
      url: "/auth/register",
      headers: { "Content-Type": "application/json" },
      payload: {
        name: "Bruno",
        email: "bruno@example.com",
        password: "Aa123456!",
        confirmPassword: "Aa123456!",
      },
    });

    expect(register.statusCode).toBe(201);

    // pega o ID do usuário no banco
    const [user] = await db.select().from(users).where(eq(users.email, "bruno@example.com"));
    expect(user).toBeDefined();

    // login para pegar accessToken
    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      headers: { "Content-Type": "application/json" },
      payload: {
        email: "bruno@example.com",
        password: "Aa123456!",
      },
    });

    expect(login.statusCode).toBe(200);

    const { accessToken } = login.json();

    // chama rota /users/:id
    const response = await app.inject({
      method: "GET",
      url: `/users/${user.id}`,
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body).toHaveProperty("id", user.id);
    expect(body).toHaveProperty("email", "bruno@example.com");
    expect(body).toHaveProperty("name", "Bruno");
    expect(body).not.toHaveProperty("passwordHash");
  });

  it("deve retornar 404 se o usuário não existir", async () => {
    const built = await buildTestApp();
    app = built.app;
    db = built.db;

    // registra e loga um usuário
    await app.inject({
      method: "POST",
      url: "/auth/register",
      headers: { "Content-Type": "application/json" },
      payload: {
        name: "Teste",
        email: "teste@example.com",
        password: "Aa123456!",
        confirmPassword: "Aa123456!",
      },
    });

    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      headers: { "Content-Type": "application/json" },
      payload: {
        email: "teste@example.com",
        password: "Aa123456!",
      },
    });

    const { accessToken } = login.json();

    // id inexistente
    const response = await app.inject({
      method: "GET",
      url: "/users/00000000-0000-0000-0000-000000000000",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(response.statusCode).toBe(404);

    const body = response.json();
    expect(body.message).toBe("Usuário não encontrado.");
  });

  it("deve retornar 401 sem token", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/users/qualquer",
    });

    expect(response.statusCode).toBe(401);
  });
});
