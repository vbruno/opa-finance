import { FastifyInstance } from "fastify";
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

describe("Check password strength", () => {
  it("deve falhar se o payload não tiver password", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/check-password-strength",
      payload: {},
    });

    expect(response.statusCode).toBe(400);
  });

  it("deve retornar força correta", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/check-password-strength",
      payload: {
        password: "Aa123456!",
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveProperty("strength");
  });
});
