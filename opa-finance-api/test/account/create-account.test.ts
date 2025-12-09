// test/account/create-account.test.ts
import { FastifyInstance } from "fastify";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildTestApp } from "../setup";

let app: FastifyInstance;

async function registerAndLogin() {
  await app.inject({
    method: "POST",
    url: "/auth/register",
    headers: { "Content-Type": "application/json" },
    payload: {
      name: "User Test",
      email: "user@test.com",
      password: "Aa123456!",
      confirmPassword: "Aa123456!",
    },
  });

  const login = await app.inject({
    method: "POST",
    url: "/auth/login",
    headers: { "Content-Type": "application/json" },
    payload: {
      email: "user@test.com",
      password: "Aa123456!",
    },
  });

  return login.json().accessToken as string;
}

describe("POST /accounts", () => {
  beforeEach(async () => {
    const built = await buildTestApp();
    app = built.app;
  });

  afterEach(async () => {
    await app.close();
  });

  it("deve criar uma conta com sucesso", async () => {
    const token = await registerAndLogin();

    const response = await app.inject({
      method: "POST",
      url: "/accounts",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      payload: {
        name: "Carteira",
        type: "cash",
        initialBalance: 100,
      },
    });

    expect(response.statusCode).toBe(201);

    const body = response.json();
    expect(body.name).toBe("Carteira");
    expect(body.type).toBe("cash");

    // agora o valor volta como number — ajuste do teste
    expect(body.initialBalance).toBe(100);
  });

  it("deve falhar ao enviar dados inválidos", async () => {
    const token = await registerAndLogin();

    const response = await app.inject({
      method: "POST",
      url: "/accounts",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        type: "cash",
      },
    });

    expect(response.statusCode).toBe(400);

    const body = response.json();
    expect(body.title).toBe("Validation Error");
    expect(body.status).toBe(400);
    expect(body.detail).toContain("Nome é obrigatório");
  });

  it("deve retornar 401 se não enviar token", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/accounts",
      payload: {
        name: "Conta Sem Token",
        type: "cash",
      },
    });

    expect(response.statusCode).toBe(401);

    const body = response.json();
    expect(body.title).toBe("Unauthorized");
    expect(body.status).toBe(401);
  });
});
