import { FastifyInstance } from "fastify";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resetTables } from "../helpers/resetTables";
import { buildTestApp } from "../setup";

let app: FastifyInstance;

async function registerAndLogin(name: string, email: string) {
  await app.inject({
    method: "POST",
    url: "/auth/register",
    headers: { "Content-Type": "application/json" },
    payload: {
      name,
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

describe("GET /accounts/:id", () => {
  beforeEach(async () => {
    const built = await buildTestApp();
    app = built.app;

    // 🧹 limpar tabelas
    await resetTables(built.db);
  });

  afterEach(async () => {
    await app.close();
  });

  it("deve obter conta com sucesso", async () => {
    const token = await registerAndLogin("User A", "a@test.com");

    const created = await app.inject({
      method: "POST",
      url: "/accounts",
      headers: { Authorization: `Bearer ${token}` },
      payload: { name: "Conta Teste", type: "cash" },
    });

    const account = created.json();

    const response = await app.inject({
      method: "GET",
      url: `/accounts/${account.id}`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().id).toBe(account.id);
  });

  it("deve retornar 404 para conta inexistente", async () => {
    const token = await registerAndLogin("User A", "a@test.com");

    const response = await app.inject({
      method: "GET",
      url: `/accounts/00000000-0000-0000-0000-000000000000`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(404);
  });

  it("deve retornar 403 se tentar acessar conta de outro usuário", async () => {
    const tokenA = await registerAndLogin("User A", "a@test.com");
    const tokenB = await registerAndLogin("User B", "b@test.com");

    // Conta criada pelo usuário A
    const created = await app.inject({
      method: "POST",
      url: "/accounts",
      headers: { Authorization: `Bearer ${tokenA}` },
      payload: { name: "Conta A", type: "cash" },
    });

    const account = created.json();

    // Tentar acessar com token do usuário B
    const response = await app.inject({
      method: "GET",
      url: `/accounts/${account.id}`,
      headers: { Authorization: `Bearer ${tokenB}` },
    });

    expect(response.statusCode).toBe(403);
  });
});
