import { describe, it, expect, beforeEach } from "vitest";
import { hashPassword } from "../../src/core/utils/hash.utils";
import { users } from "../../src/db/schema";
import { app, db } from "../setup";

describe("Rota /auth/me", () => {
  beforeEach(async () => {
    await db.delete(users);
  });

  it("deve retornar userId quando autenticado", async () => {
    // cria usuário
    const [createdUser] = await db
      .insert(users)
      .values({
        name: "Bruno",
        email: "bruno@example.com",
        passwordHash: await hashPassword("Aa123456!"),
      })
      .returning();

    // login para obter token
    const loginResponse = await app.inject({
      method: "POST",
      url: "/auth/login",
      headers: {
        "Content-Type": "application/json",
      },
      payload: {
        email: "bruno@example.com",
        password: "Aa123456!",
      },
    });

    const { accessToken } = loginResponse.json();

    // chamada à rota protegida
    const response = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body).toEqual({
      userId: createdUser.id,
    });
  });

  it("deve retornar 401 sem token", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/auth/me",
    });

    expect(response.statusCode).toBe(401);
  });

  it("deve retornar 401 com token inválido", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: {
        Authorization: "Bearer token_invalido",
      },
    });

    expect(response.statusCode).toBe(401);
  });
});
