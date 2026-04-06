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

describe("Alterar senha", () => {
  async function registerAndLogin() {
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

    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      headers: { "Content-Type": "application/json" },
      payload: {
        email: "user@example.com",
        password: "Aa123456!",
      },
    });

    return login.json().accessToken;
  }

  it("deve alterar senha com sucesso", async () => {
    const token = await registerAndLogin();

    const response = await app.inject({
      method: "POST",
      url: "/auth/change-password",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      payload: {
        currentPassword: "Aa123456!",
        newPassword: "Bb123456!",
        confirmNewPassword: "Bb123456!",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().message).toBe("Senha alterada com sucesso.");
  });

  it("deve retornar 400 se a senha atual estiver incorreta", async () => {
    const token = await registerAndLogin();

    const response = await app.inject({
      method: "POST",
      url: "/auth/change-password",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      payload: {
        currentPassword: "Errada!",
        newPassword: "Bb123456!",
        confirmNewPassword: "Bb123456!",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().detail).toBe("Senha atual incorreta.");
  });

  it("deve retornar 401 sem token", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/change-password",
      payload: {},
    });

    expect(response.statusCode).toBe(401);
  });
});
