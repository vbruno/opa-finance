import { FastifyInstance } from "fastify";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { DB } from "../../src/core/plugins/drizzle-test";
import { users } from "../../src/db/schema";
import { buildTestApp } from "../setup";

let app: FastifyInstance;
let db: DB;

describe("GET /users", () => {
  beforeEach(async () => {
    const built = await buildTestApp();
    app = built.app;
    db = built.db;

    // limpa tabela
    await db.delete(users);
  });

  afterEach(async () => {
    await app.close();
  });

  async function createAndLogin(name: string, email: string) {
    // registro
    await app.inject({
      method: "POST",
      url: "/auth/register",
      headers: { "Content-Type": "application/json" },
      payload: {
        name,
        email,
        password: "Aa123456!",
        confirmPassword: "Aa123456!",
      },
    });

    // login
    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      headers: { "Content-Type": "application/json" },
      payload: {
        email,
        password: "Aa123456!",
      },
    });

    const { accessToken } = login.json();
    return accessToken;
  }

  it("deve listar usuários com sucesso", async () => {
    const accessToken = await createAndLogin("Bruno", "bruno@example.com");

    // cria outro usuário
    await app.inject({
      method: "POST",
      url: "/auth/register",
      headers: { "Content-Type": "application/json" },
      payload: {
        name: "Ana",
        email: "ana@example.com",
        password: "Aa123456!",
        confirmPassword: "Aa123456!",
      },
    });

    const response = await app.inject({
      method: "GET",
      url: "/users",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body).toHaveProperty("data");
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(2);

    // não deve conter passwordHash
    body.data.forEach((u: any) => {
      expect(u).not.toHaveProperty("passwordHash");
    });
  });

  it("deve aplicar filtro por nome", async () => {
    const accessToken = await createAndLogin("Bruno", "bruno@example.com");

    // cria mais um usuário
    await app.inject({
      method: "POST",
      url: "/auth/register",
      headers: { "Content-Type": "application/json" },
      payload: {
        name: "Fernanda",
        email: "fernanda@example.com",
        password: "Aa123456!",
        confirmPassword: "Aa123456!",
      },
    });

    const response = await app.inject({
      method: "GET",
      url: "/users?name=Fer",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.statusCode).toBe(200);

    const { data } = response.json();

    expect(data.length).toBe(1);
    expect(data[0].name).toBe("Fernanda");
  });

  it("deve aplicar filtro por email", async () => {
    const accessToken = await createAndLogin("Bruno", "bruno@example.com");

    await app.inject({
      method: "POST",
      url: "/auth/register",
      headers: { "Content-Type": "application/json" },
      payload: {
        name: "Carlos",
        email: "carlos@example.com",
        password: "Aa123456!",
        confirmPassword: "Aa123456!",
      },
    });

    const response = await app.inject({
      method: "GET",
      url: "/users?email=carlos",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.statusCode).toBe(200);

    const { data } = response.json();

    expect(data.length).toBe(1);
    expect(data[0].email).toBe("carlos@example.com");
  });

  it("deve retornar 401 sem token", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/users",
    });

    expect(response.statusCode).toBe(401);
  });
});
