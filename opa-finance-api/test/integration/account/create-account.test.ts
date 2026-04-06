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

describe.sequential("POST /accounts", () => {
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
      },
    });

    expect(response.statusCode).toBe(201);

    const body = response.json();
    expect(body.name).toBe("Carteira");
    expect(body.type).toBe("cash");

    expect(body.currentBalance).toBe(0);
    expect(body.isPrimary).toBe(true);
  });

  it("deve marcar a primeira conta como principal automaticamente", async () => {
    const token = await registerAndLogin();

    const response = await app.inject({
      method: "POST",
      url: "/accounts",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      payload: {
        name: "Conta Inicial",
        type: "cash",
        isPrimary: false,
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().isPrimary).toBe(true);
  });

  it("deve desmarcar a conta anterior ao criar nova conta principal", async () => {
    const token = await registerAndLogin();

    const first = await app.inject({
      method: "POST",
      url: "/accounts",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      payload: {
        name: "Conta A",
        type: "cash",
        isPrimary: true,
      },
    });

    expect(first.statusCode).toBe(201);
    expect(first.json().isPrimary).toBe(true);

    const second = await app.inject({
      method: "POST",
      url: "/accounts",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      payload: {
        name: "Conta B",
        type: "checking_account",
        isPrimary: true,
      },
    });

    expect(second.statusCode).toBe(201);
    expect(second.json().isPrimary).toBe(true);

    const list = await app.inject({
      method: "GET",
      url: "/accounts",
      headers: { Authorization: `Bearer ${token}` },
    });

    const accounts = list.json();
    const primaryAccounts = accounts.filter((acc: any) => acc.isPrimary === true);

    expect(primaryAccounts.length).toBe(1);
    expect(primaryAccounts[0].name).toBe("Conta B");
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
