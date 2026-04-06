// test/auth/password/forgot-password.test.ts
import type { FastifyInstance } from "fastify";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildTestApp } from "../../setup";

let app: FastifyInstance;

beforeEach(async () => {
  const built = await buildTestApp();
  app = built.app;
});

afterEach(async () => {
  await app.close();
});

describe("POST /auth/forgot-password", () => {
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

  it("deve retornar sucesso para email existente", async () => {
    await register();

    const response = await app.inject({
      method: "POST",
      url: "/auth/forgot-password",
      headers: { "Content-Type": "application/json" },
      payload: { email: "user@example.com" },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.message).toBe("Se o email existir, enviaremos um link de redefinição.");
    expect(body).toHaveProperty("resetToken");
  });

  it("deve retornar sucesso mesmo para email inexistente", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/forgot-password",
      headers: { "Content-Type": "application/json" },
      payload: { email: "inexistente@example.com" },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.message).toBe("Se o email existir, enviaremos um link de redefinição.");
  });
});
