// test/user/delete-user.test.ts
import { eq } from "drizzle-orm";
import { FastifyInstance } from "fastify";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { DB } from "../../src/core/plugins/drizzle";
import { users } from "../../src/db/schema";
import { buildTestApp } from "../setup";

let app: FastifyInstance;
let db: DB;

describe("DELETE /users/:id", () => {
  beforeEach(async () => {
    const built = await buildTestApp();
    app = built.app;
    db = built.db;

    await db.delete(users);
  });

  afterEach(async () => {
    await app.close();
  });

  async function registerAndLogin(name: string, email: string) {
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
    const [user] = await db.select().from(users).where(eq(users.email, email));

    return { accessToken, user };
  }

  it("deve remover o próprio usuário", async () => {
    const { accessToken, user } = await registerAndLogin("Bruno", "bruno@example.com");

    const response = await app.inject({
      method: "DELETE",
      url: `/users/${user.id}`,
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.message).toBe("Usuário removido com sucesso.");

    const exists = await db.select().from(users).where(eq(users.id, user.id));
    expect(exists.length).toBe(0);
  });

  it("não deve permitir excluir outro usuário", async () => {
    const { accessToken } = await registerAndLogin("Bruno", "bruno@example.com");
    const other = await registerAndLogin("Ana", "ana@example.com");

    const response = await app.inject({
      method: "DELETE",
      url: `/users/${other.user.id}`,
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(response.statusCode).toBe(403);

    const body = response.json();
    expect(body.detail).toBe("Você não pode remover este usuário.");
    expect(body.title).toBe("Forbidden");
    expect(body.status).toBe(403);
  });

  it("deve retornar 404 se o usuário não existir", async () => {
    const { accessToken } = await registerAndLogin("Bruno", "bruno@example.com");

    const response = await app.inject({
      method: "DELETE",
      url: `/users/00000000-0000-0000-0000-000000000000`,
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(response.statusCode).toBe(404);

    const body = response.json();
    expect(body.detail).toBe("Usuário não encontrado.");
    expect(body.title).toBe("Not Found");
    expect(body.status).toBe(404);
  });

  it("deve retornar 401 sem token", async () => {
    const response = await app.inject({
      method: "DELETE",
      url: "/users/qualquer",
    });

    expect(response.statusCode).toBe(401);

    const body = response.json();
    expect(body.title).toBe("Unauthorized");
    expect(body.status).toBe(401);
  });
});
