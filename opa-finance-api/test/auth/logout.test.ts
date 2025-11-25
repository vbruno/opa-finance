import { describe, it, expect, beforeEach } from "vitest";
import { hashPassword } from "../../src/core/utils/hash.utils";
import { users } from "../../src/db/schema";
import { app, db } from "../setup";

describe("Rota /auth/logout", () => {
  beforeEach(async () => {
    await db.delete(users);
  });

  it("deve limpar o refreshToken e retornar mensagem de sucesso", async () => {
    // cria usuário
    await db.insert(users).values({
      name: "Bruno",
      email: "bruno@example.com",
      passwordHash: await hashPassword("Aa123456!"),
    });

    // login para gerar refreshToken
    const loginResponse = await app.inject({
      method: "POST",
      url: "/auth/login",
      headers: { "Content-Type": "application/json" },
      payload: {
        email: "bruno@example.com",
        password: "Aa123456!",
      },
    });

    const refreshCookie = loginResponse.cookies.find((c) => c.name === "refreshToken");
    if (!refreshCookie) throw new Error("Refresh token cookie nao encontrado no loginResponse");
    expect(refreshCookie).toBeDefined();

    // logout
    const response = await app.inject({
      method: "POST",
      url: "/auth/logout",
      cookies: {
        refreshToken: refreshCookie.value,
      },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.message).toBe("Logged out");

    // cookie deve ser removido
    const cleared = response.cookies.find((c) => c.name === "refreshToken");
    if (!cleared) throw new Error("Cookie de refreshToken nao encontrado na resposta de logout");

    expect(cleared).toBeDefined();
    expect(cleared.value).toBe("");
    expect(cleared.expires).toEqual(expect.any(Date));
  });

  it("deve funcionar mesmo sem cookie de refresh (logout idempotente)", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/logout",
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.message).toBe("Logged out");
  });
});
