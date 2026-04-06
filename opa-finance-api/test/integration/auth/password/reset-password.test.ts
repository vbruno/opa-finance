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

describe("POST /auth/reset-password", () => {
  async function generateResetToken() {
    // Registrar usuário
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

    // Solicitar reset
    const resp = await app.inject({
      method: "POST",
      url: "/auth/forgot-password",
      headers: { "Content-Type": "application/json" },
      payload: { email: "user@example.com" },
    });

    return resp.json().resetToken;
  }

  it("deve redefinir a senha com sucesso", async () => {
    const token = await generateResetToken();

    const response = await app.inject({
      method: "POST",
      url: "/auth/reset-password",
      headers: { "Content-Type": "application/json" },
      payload: {
        token,
        newPassword: "NewPassword1!",
        confirmNewPassword: "NewPassword1!",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().message).toBe("Senha redefinida com sucesso.");
  });

  it("deve falhar com token inválido", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/reset-password",
      headers: { "Content-Type": "application/json" },
      payload: {
        token: "token-invalido",
        newPassword: "NewPassword1!",
        confirmNewPassword: "NewPassword1!",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().title).toBe("Validation Error");
  });

  it("deve falhar com senhas diferentes", async () => {
    const token = await generateResetToken();

    const response = await app.inject({
      method: "POST",
      url: "/auth/reset-password",
      headers: { "Content-Type": "application/json" },
      payload: {
        token,
        newPassword: "NewPassword1!",
        confirmNewPassword: "OutraSenha!",
      },
    });

    expect(response.statusCode).toBe(400);
  });
});
