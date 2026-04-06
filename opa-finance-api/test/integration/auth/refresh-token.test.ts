import type { FastifyInstance } from "fastify";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildTestApp } from "../setup";

let app: FastifyInstance;

beforeEach(async () => {
  const built = await buildTestApp();
  app = built.app;
});

afterEach(async () => {
  await app.close();
});

describe("POST /auth/refresh", () => {
  async function login() {
    await app.inject({
      method: "POST",
      url: "/auth/register",
      headers: { "Content-Type": "application/json" },
      payload: {
        name: "User",
        email: "user@example.com",
        password: "Aa123456!",
        confirmPassword: "Aa123456!",
      },
    });

    const resp = await app.inject({
      method: "POST",
      url: "/auth/login",
      headers: { "Content-Type": "application/json" },
      payload: {
        email: "user@example.com",
        password: "Aa123456!",
      },
    });

    return resp;
  }

  it("deve atualizar o accessToken com sucesso", async () => {
    const loginResponse = await login();
    const cookies = loginResponse.cookies;

    const refreshResp = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      cookies: {
        refreshToken: cookies[0].value,
      },
    });

    expect(refreshResp.statusCode).toBe(200);
    expect(refreshResp.json()).toHaveProperty("accessToken");
  });

  it("deve retornar 401 se refresh token for inválido", async () => {
    const resp = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      cookies: {
        refreshToken: "invalid",
      },
    });

    expect(resp.statusCode).toBe(401);
    expect(resp.json().title).toBe("Unauthorized");
  });
});
