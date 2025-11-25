import { describe, it, expect, beforeEach } from "vitest";
import { hashPassword } from "../../src/core/utils/hash.utils";
import { users } from "../../src/db/schema";
import { app } from "../setup";
import { db } from "../setup";

describe("Login de usuário", () => {
  // limpa usuários antes de cada teste
  beforeEach(async () => {
    await db.delete(users);
  });

  it("deve logar com sucesso e retornar accessToken", async () => {
    // cria usuário manualmente no banco
    await db.insert(users).values({
      name: "Bruno",
      email: "bruno@example.com",
      passwordHash: await hashPassword("Aa123456!"),
    });

    const response = await app.inject({
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

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body).toHaveProperty("accessToken");
  });

  it("deve falhar ao tentar logar com email inexistente", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      headers: {
        "Content-Type": "application/json",
      },
      payload: {
        email: "naoexiste@example.com",
        password: "Aa123456!",
      },
    });

    expect(response.statusCode).toBe(400);

    const body = response.json();
    expect(body.message).toBe("Credenciais inválidas.");
  });

  it("deve falhar ao tentar logar com senha incorreta", async () => {
    await db.insert(users).values({
      name: "Bruno",
      email: "bruno@example.com",
      passwordHash: await hashPassword("Aa123456!"),
    });

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      headers: {
        "Content-Type": "application/json",
      },
      payload: {
        email: "bruno@example.com",
        password: "SenhaErrada123!",
      },
    });

    expect(response.statusCode).toBe(400);

    const body = response.json();
    expect(body.message).toBe("Credenciais inválidas.");
  });

  it("deve retornar erro de validação se o payload for inválido", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      headers: {
        "Content-Type": "application/json",
      },
      payload: {
        email: "email-invalido",
        password: "123",
      },
    });

    expect(response.statusCode).toBe(400);

    const body = response.json();
    expect(body).toHaveProperty("message");
  });
});
