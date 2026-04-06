// test/account/list-accounts.test.ts
import { FastifyInstance } from "fastify";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildTestApp } from "../setup";

let app: FastifyInstance;

async function registerAndLogin(email = "user@test.com") {
  await app.inject({
    method: "POST",
    url: "/auth/register",
    headers: { "Content-Type": "application/json" },
    payload: {
      name: "User",
      email,
      password: "Aa123456!",
      confirmPassword: "Aa123456!",
    },
  });

  const login = await app.inject({
    method: "POST",
    url: "/auth/login",
    headers: { "Content-Type": "application/json" },
    payload: {
      email,
      password: "Aa123456!",
    },
  });

  return login.json().accessToken;
}

describe.sequential("GET /accounts", () => {
  beforeEach(async () => {
    const built = await buildTestApp();
    app = built.app;
  });

  afterEach(async () => {
    await app.close();
  });

  it("deve listar apenas contas do usuário autenticado", async () => {
    const token = await registerAndLogin();

    await app.inject({
      method: "POST",
      url: "/accounts",
      headers: { Authorization: `Bearer ${token}` },
      payload: { name: "Conta 1", type: "cash" },
    });

    await app.inject({
      method: "POST",
      url: "/accounts",
      headers: { Authorization: `Bearer ${token}` },
      payload: { name: "Conta 2", type: "checking_account" },
    });

    const response = await app.inject({
      method: "GET",
      url: "/accounts",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(2);
    expect(body.every((acc: any) => typeof acc.isPrimary === "boolean")).toBe(true);
  });

  it("não deve listar contas de outro usuário", async () => {
    const tokenA = await registerAndLogin("userA@test.com");
    const tokenB = await registerAndLogin("userB@test.com");

    await app.inject({
      method: "POST",
      url: "/accounts",
      headers: { Authorization: `Bearer ${tokenA}` },
      payload: { name: "Conta A", type: "cash" },
    });

    const response = await app.inject({
      method: "GET",
      url: "/accounts",
      headers: { Authorization: `Bearer ${tokenB}` },
    });

    const body = response.json();

    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(0);
  });

  it("deve retornar 401 sem token", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/accounts",
    });

    expect(response.statusCode).toBe(401);

    const body = response.json();
    expect(body.title).toBe("Unauthorized");
    expect(body.status).toBe(401);
  });
});
