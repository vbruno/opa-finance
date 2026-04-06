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

describe("Login", () => {
  async function register() {
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
  }

  it("deve logar com sucesso", async () => {
    await register();

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      headers: { "Content-Type": "application/json" },
      payload: {
        email: "user@example.com",
        password: "Aa123456!",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty("accessToken");
  });

  it("deve retornar 401 para senha incorreta", async () => {
    await register();

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      headers: { "Content-Type": "application/json" },
      payload: {
        email: "user@example.com",
        password: "senhaErrada",
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().title).toBe("Unauthorized");
  });

  it("deve retornar 401 para email inexistente", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      headers: { "Content-Type": "application/json" },
      payload: {
        email: "naoexiste@example.com",
        password: "Aa123456!",
      },
    });

    expect(response.statusCode).toBe(401);
  });
});
