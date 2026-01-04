// test/user/get-user.test.ts

import { eq } from "drizzle-orm";
import { FastifyInstance } from "fastify";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { DB } from "../../src/core/plugins/drizzle";
import { users } from "../../src/db/schema";
import { buildTestApp } from "../setup";

let app: FastifyInstance;
let db: DB;

describe.sequential("GET /users/:id", () => {
  beforeEach(async () => {
    const built = await buildTestApp();
    app = built.app;
    db = built.db;

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

    // pega usuário do banco
    const [user] = await db.select().from(users).where(eq(users.email, "bruno@example.com"));
    expect(user).toBeDefined();

    // login
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

    // GET /users/:id
    const response = await app.inject({
      method: "GET",
      url: `/users/${user.id}`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body).toHaveProperty("id", user.id);
    expect(body).toHaveProperty("email", "bruno@example.com");
    expect(body).toHaveProperty("name", "Bruno");
    expect(body).not.toHaveProperty("passwordHash");
  });

  it("deve retornar 404 se o usuário não existir", async () => {
    // cria qualquer usuário apenas para fazer login
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

    const response = await app.inject({
      method: "GET",
      url: "/users/00000000-0000-0000-0000-000000000000",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.statusCode).toBe(404);

    const body = response.json();
    expect(body.detail).toBe("Usuário não encontrado.");
  });

  it("deve retornar 403 ao tentar acessar outro usuário", async () => {
    await app.inject({
      method: "POST",
      url: "/auth/register",
      headers: { "Content-Type": "application/json" },
      payload: {
        name: "User A",
        email: "a@example.com",
        password: "Aa123456!",
        confirmPassword: "Aa123456!",
      },
    });

    await app.inject({
      method: "POST",
      url: "/auth/register",
      headers: { "Content-Type": "application/json" },
      payload: {
        name: "User B",
        email: "b@example.com",
        password: "Aa123456!",
        confirmPassword: "Aa123456!",
      },
    });

    const [userA] = await db.select().from(users).where(eq(users.email, "a@example.com"));
    const [userB] = await db.select().from(users).where(eq(users.email, "b@example.com"));

    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      headers: { "Content-Type": "application/json" },
      payload: {
        email: "a@example.com",
        password: "Aa123456!",
      },
    });

    const { accessToken } = login.json();

    const response = await app.inject({
      method: "GET",
      url: `/users/${userB.id}`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().detail).toBe("Você não pode acessar este usuário.");
  });

  it("deve retornar 401 sem token", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/users/qualquer",
    });

    expect(response.statusCode).toBe(401);
  });
});
