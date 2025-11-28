import { FastifyInstance } from "fastify";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildTestApp } from "../setup";

let app: FastifyInstance;

beforeEach(async () => {
  const built = await buildTestApp();
  app = built.app;

  // cria usuário
  await app.inject({
    method: "POST",
    url: "/auth/register",
    headers: { "Content-Type": "application/json" },
    payload: {
      name: "Bruno",
      email: "bruno@example.com",
      password: "Aa123456!",
      confirmPassword: "Aa123456!",
    },
  });
});

afterEach(async () => {
  await app.close();
});

describe.sequential("Login", () => {
  it("deve logar com sucesso", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      headers: { "Content-Type": "application/json" },
      payload: {
        email: "bruno@example.com",
        password: "Aa123456!",
      },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body).toHaveProperty("accessToken");
  });

  it("deve falhar com senha incorreta", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      headers: { "Content-Type": "application/json" },
      payload: {
        email: "bruno@example.com",
        password: "errada123",
      },
    });

    expect(response.statusCode).toBe(400);
  });
});
