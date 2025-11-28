import { FastifyInstance } from "fastify";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildTestApp } from "../setup";

let app: FastifyInstance;

beforeEach(async () => {
  const built = await buildTestApp();
  app = built.app;

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

describe("GET /auth/me", () => {
  it("deve retornar o usuário autenticado", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      headers: { "Content-Type": "application/json" },
      payload: {
        email: "bruno@example.com",
        password: "Aa123456!",
      },
    });

    expect(login.statusCode).toBe(200);

    const { accessToken } = login.json();

    expect(accessToken).toBeDefined();

    const response = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    console.log("login status:", response.statusCode, response.body);

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body).toHaveProperty("id");
    expect(body).toHaveProperty("email", "bruno@example.com");
    expect(body).not.toHaveProperty("passwordHash");
  });

  it("deve retornar 401 se não enviar token", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/auth/me",
    });

    expect(response.statusCode).toBe(401);
  });
});
