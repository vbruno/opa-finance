import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildTestApp } from "../setup";

let app: any;

async function registerAndLogin(email = "user@test.com") {
  await app.inject({
    method: "POST",
    url: "/auth/register",
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
    payload: { email, password: "Aa123456!" },
  });

  return login.json().accessToken;
}

describe("PUT /accounts/:id", () => {
  beforeEach(async () => {
    const built = await buildTestApp();
    app = built.app;
  });

  afterEach(async () => {
    await app.close();
  });

  it("deve atualizar conta com sucesso", async () => {
    const token = await registerAndLogin();

    const created = await app.inject({
      method: "POST",
      url: "/accounts",
      headers: { Authorization: `Bearer ${token}` },
      payload: { name: "Conta", type: "cash" },
    });

    const account = created.json();

    const response = await app.inject({
      method: "PUT",
      url: `/accounts/${account.id}`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { name: "Conta Alterada" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().name).toBe("Conta Alterada");
  });

  it("não deve atualizar conta de outro usuário", async () => {
    const tokenA = await registerAndLogin("userA@test.com");
    const tokenB = await registerAndLogin("userB@test.com");

    const created = await app.inject({
      method: "POST",
      url: "/accounts",
      headers: { Authorization: `Bearer ${tokenA}` },
      payload: { name: "Conta A", type: "cash" },
    });

    const account = created.json();

    const response = await app.inject({
      method: "PUT",
      url: `/accounts/${account.id}`,
      headers: { Authorization: `Bearer ${tokenB}` },
      payload: { name: "Hack" },
    });

    expect(response.statusCode).toBe(403);
  });

  it("deve retornar 404 para conta inexistente", async () => {
    const token = await registerAndLogin();

    const response = await app.inject({
      method: "PUT",
      url: `/accounts/00000000-0000-0000-0000-000000000000`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { name: "Teste" },
    });

    expect(response.statusCode).toBe(404);
  });
});
