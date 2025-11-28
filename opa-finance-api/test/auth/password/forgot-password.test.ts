import { FastifyInstance } from "fastify";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildTestApp } from "../../setup";

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

describe("Reset Password", () => {
  it("deve resetar a senha com sucesso usando token válido", async () => {
    // gerar token
    const forgot = await app.inject({
      method: "POST",
      url: "/auth/forgot-password",
      headers: { "Content-Type": "application/json" },
      payload: { email: "bruno@example.com" },
    });

    const { resetToken } = forgot.json();

    const response = await app.inject({
      method: "POST",
      url: "/auth/reset-password",
      headers: { "Content-Type": "application/json" },
      payload: {
        token: resetToken,
        newPassword: "Bb123456!",
        confirmNewPassword: "Bb123456!",
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
        token: "token_invalido",
        newPassword: "Bb123456!",
        confirmNewPassword: "Bb123456!",
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it("deve falhar se as senhas não conferem", async () => {
    const forgot = await app.inject({
      method: "POST",
      url: "/auth/forgot-password",
      headers: { "Content-Type": "application/json" },
      payload: { email: "bruno@example.com" },
    });

    const { resetToken } = forgot.json();

    const response = await app.inject({
      method: "POST",
      url: "/auth/reset-password",
      headers: { "Content-Type": "application/json" },
      payload: {
        token: resetToken,
        newPassword: "Bb123456!",
        confirmNewPassword: "errado123",
      },
    });

    expect(response.statusCode).toBe(400);
  });
});
