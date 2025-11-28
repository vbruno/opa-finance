import { FastifyInstance } from "fastify";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildTestApp } from "../../setup";

let app: FastifyInstance;

async function createAndLogin() {
  // registrar usuário
  const register = await app.inject({
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

  expect(register.statusCode).toBe(201);

  const login = await app.inject({
    method: "POST",
    url: "/auth/login",
    headers: { "Content-Type": "application/json" },
    payload: {
      email: "bruno@example.com",
      password: "Aa123456!",
    },
  });

  const { accessToken } = login.json();

  return accessToken;
}

beforeEach(async () => {
  const built = await buildTestApp();
  app = built.app;
});

afterEach(async () => {
  await app.close();
});

describe("Change Password", () => {
  it("deve alterar a senha com sucesso", async () => {
    const token = await createAndLogin();

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

    const body = response.json();
    expect(body.message).toBe("Senha alterada com sucesso.");
  });

  it("deve falhar se a senha atual estiver incorreta", async () => {
    const token = await createAndLogin();

    const response = await app.inject({
      method: "POST",
      url: "/auth/change-password",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      payload: {
        currentPassword: "senha_errada",
        newPassword: "Bb123456!",
        confirmNewPassword: "Bb123456!",
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it("deve retornar 400 para payload inválido", async () => {
    const token = await createAndLogin();

    const response = await app.inject({
      method: "POST",
      url: "/auth/change-password",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      payload: {}, // payload inválido
    });

    expect(response.statusCode).toBe(400);
  });

  it("deve retornar 401 sem token", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/change-password",
      payload: {
        currentPassword: "Aa123456!",
        newPassword: "Bb123456!",
        confirmNewPassword: "Bb123456!",
      },
    });

    expect(response.statusCode).toBe(401);
  });
});
