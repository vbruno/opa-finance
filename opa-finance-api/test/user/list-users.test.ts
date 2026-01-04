// test/user/list-users.test.ts
import { FastifyInstance } from "fastify";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { DB } from "../../src/core/plugins/drizzle"; // ✔ correto
import { users } from "../../src/db/schema";
import { buildTestApp } from "../setup";

let app: FastifyInstance;
let db: DB;

describe("GET /users", () => {
  beforeEach(async () => {
    const built = await buildTestApp();
    app = built.app;
    db = built.db;

    await db.delete(users);
  });

  afterEach(async () => {
    await app.close();
  });

  async function createAndLogin(name: string, email: string) {
    // registra
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
    const loginResponse = await app.inject({
      method: "POST",
      url: "/auth/login",
      headers: { "Content-Type": "application/json" },
      payload: {
        email,
        password: "Aa123456!",
      },
    });

    expect(loginResponse.statusCode).toBe(200);

    const { accessToken } = loginResponse.json();

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
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body).toHaveProperty("data");
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(1);
    expect(body.data[0].email).toBe("bruno@example.com");

    // passwordHash não pode aparecer
    for (const u of body.data) {
      expect(u).not.toHaveProperty("passwordHash");
    }
  });

  it("deve respeitar filtro por nome apenas no próprio usuário", async () => {
    const accessToken = await createAndLogin("Bruno", "bruno@example.com");

    const response = await app.inject({
      method: "GET",
      url: "/users?name=Fer",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(response.statusCode).toBe(200);

    const { data } = response.json();

    expect(data.length).toBe(0);
  });

  it("deve respeitar filtro por email apenas no próprio usuário", async () => {
    const accessToken = await createAndLogin("Bruno", "bruno@example.com");

    const response = await app.inject({
      method: "GET",
      url: "/users?email=carlos",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(response.statusCode).toBe(200);

    const { data } = response.json();

    expect(data.length).toBe(0);
  });

  it("deve retornar 401 sem token", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/users",
    });

    expect(response.statusCode).toBe(401);
  });
});
