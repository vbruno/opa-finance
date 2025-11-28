import { FastifyInstance } from "fastify";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildTestApp } from "../setup";

let app: FastifyInstance;

beforeEach(async () => {
  const built = await buildTestApp();
  app = built.app;

  // cria usuario
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

describe("Refresh Token", () => {
  it("deve gerar novo accessToken", async () => {
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

    const cookie = login.cookies.find((c) => c.name === "refreshToken");
    expect(cookie).toBeDefined();

    const response = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      cookies: {
        refreshToken: cookie!.value,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty("accessToken");
  });
});
