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

describe("Registro de usuário", () => {
  it("deve registrar um usuário com sucesso", async () => {
    const response = await app.inject({
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

    expect(response.statusCode).toBe(201);
    expect(response.json()).toHaveProperty("accessToken");
  });

  it("deve falhar ao tentar registrar email duplicado", async () => {
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

    const response = await app.inject({
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

    expect(response.statusCode).toBe(409);

    const body = response.json();
    expect(body.title).toBe("Conflict");
    expect(body.detail).toBe("E-mail já cadastrado.");
  });
});
