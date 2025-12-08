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

describe("GET /auth/me", () => {
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

    return resp.json().accessToken;
  }

  it("deve retornar dados do usuário autenticado", async () => {
    const token = await login();

    const resp = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(resp.statusCode).toBe(200);
    const body = resp.json();
    expect(body.email).toBe("user@example.com");
    expect(body).not.toHaveProperty("passwordHash");
  });

  it("deve retornar 401 sem token", async () => {
    const resp = await app.inject({
      method: "GET",
      url: "/auth/me",
    });

    expect(resp.statusCode).toBe(401);
  });
});
