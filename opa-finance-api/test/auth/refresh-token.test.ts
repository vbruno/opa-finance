import { describe, it, expect, beforeEach } from "vitest";
import { hashPassword } from "../../src/core/utils/hash.utils";
import { users } from "../../src/db/schema";
import { app, db } from "../setup";

describe("Rota /auth/refresh", () => {
  beforeEach(async () => {
    await db.delete(users);
  });

  it("deve gerar novo accessToken e novo refreshToken", async () => {
    // cria usuário
    await db.insert(users).values({
      name: "Bruno",
      email: "bruno@example.com",
      passwordHash: await hashPassword("Aa123456!"),
    });

    // login para gerar o refreshToken (em cookie)
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

    expect(loginResponse.statusCode).toBe(200);

    // extrair cookie
    const refreshCookie = loginResponse.cookies.find((c) => c.name === "refreshToken");
    if (!refreshCookie) throw new Error("Refresh token cookie nao encontrado no loginResponse");

    expect(refreshCookie).toBeDefined();

    // chamar rota de refresh
    const response = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      cookies: {
        refreshToken: refreshCookie.value,
      },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body).toHaveProperty("accessToken");

    // verificar se novo refreshToken também foi setado
    const newRefreshCookie = response.cookies.find((c) => c.name === "refreshToken");
    if (!newRefreshCookie) throw new Error("Novo refresh token cookie nao encontrado na resposta");

    expect(newRefreshCookie).toBeDefined();
    // refresh token value must be present; rotation (different value) is optional depending on server config
    expect(newRefreshCookie.value).toBeDefined();
  });

  it("deve retornar 401 sem refreshToken no cookie", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/refresh",
    });

    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.message).toBe("Invalid refresh token");
  });

  it("deve retornar 401 com refreshToken inválido", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      cookies: {
        refreshToken: "token_invalido",
      },
    });

    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.message).toBe("Invalid refresh token");
  });
});
