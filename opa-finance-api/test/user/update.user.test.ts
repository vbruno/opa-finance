// test/user/update.user.test.ts

import { eq } from "drizzle-orm";
import { FastifyInstance } from "fastify";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { DB } from "../../src/core/plugins/drizzle"; // ✔ correto
import { users } from "../../src/db/schema";
import { buildTestApp } from "../setup";
import { hashPassword } from "@/core/utils/hash.utils";

let app: FastifyInstance;
let db: DB;

describe("PUT /users/:id", () => {
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

  it("deve atualizar o próprio usuário com sucesso", async () => {
    const { accessToken, user } = await registerAndLogin("Bruno", "bruno@example.com");

    const response = await app.inject({
      method: "PUT",
      url: `/users/${user.id}`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      payload: {
        name: "Bruno Modificado",
      },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body.name).toBe("Bruno Modificado");
    expect(body.email).toBe("bruno@example.com");
    expect(body).not.toHaveProperty("passwordHash");
  });

  it("não deve permitir atualizar outro usuário", async () => {
    const { accessToken } = await registerAndLogin("Bruno", "bruno@example.com");
    const other = await registerAndLogin("Ana", "ana@example.com");

    const response = await app.inject({
      method: "PUT",
      url: `/users/${other.user.id}`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      payload: {
        name: "Tentativa inválida",
      },
    });

    expect(response.statusCode).toBe(403);

    const body = response.json();

    // ✔ Novo padrão RFC7807
    expect(body.detail).toBe("Você não pode atualizar este usuário.");
    expect(body.title).toBe("Forbidden");
    expect(body.status).toBe(403);
    expect(body.instance).toBe(`/users/${other.user.id}`);
  });

  it("deve retornar 404 se o usuário não existir", async () => {
    // cria usuário válido
    await db.insert(users).values({
      name: "Bruno",
      email: "bruno@example.com",
      passwordHash: await hashPassword("Aa123456!"),
    });

    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      headers: { "Content-Type": "application/json" },
      payload: {
        email: "bruno@example.com",
        password: "Aa123456!",
      },
    });

    const { accessToken } = login.json();

    const fakeId = "11111111-1111-1111-1111-111111111111";

    const response = await app.inject({
      method: "PUT",
      url: `/users/${fakeId}`,
      headers: { Authorization: `Bearer ${accessToken}` },
      payload: {
        name: "Novo Nome",
      },
    });

    expect(response.statusCode).toBe(404);

    const body = response.json();

    expect(body.detail).toBe("Usuário não encontrado.");
    expect(body.title).toBe("Not Found");
    expect(body.status).toBe(404);
    expect(body.instance).toBe(`/users/${fakeId}`);
  });

  it("deve retornar 401 sem token", async () => {
    const response = await app.inject({
      method: "PUT",
      url: "/users/qualquer",
      payload: {
        name: "X",
      },
    });

    expect(response.statusCode).toBe(401);
  });
});
