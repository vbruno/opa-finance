// test/auth/password-strength.test.ts
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

describe("POST /auth/check-password-strength", () => {
  it("deve retornar força da senha corretamente", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/check-password-strength",
      headers: { "Content-Type": "application/json" },
      payload: {
        password: "Aa123456!",
      },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body).toHaveProperty("strength");
  });

  it("deve retornar 400 se a senha estiver vazia", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/check-password-strength",
      headers: { "Content-Type": "application/json" },
      payload: {
        password: "",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().title).toBe("Validation Error");
  });

  it("deve retornar 400 se a senha estiver ausente no payload", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/check-password-strength",
      headers: { "Content-Type": "application/json" },
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().title).toBe("Validation Error");
  });
});
