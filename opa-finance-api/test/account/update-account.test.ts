// test/account/update-account.test.ts
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

    const body = response.json();
    expect(body.name).toBe("Conta Alterada");
  });

  it("deve trocar a conta principal ao atualizar isPrimary", async () => {
    const token = await registerAndLogin();

    const first = await app.inject({
      method: "POST",
      url: "/accounts",
      headers: { Authorization: `Bearer ${token}` },
      payload: { name: "Conta A", type: "cash", isPrimary: true },
    });

    const second = await app.inject({
      method: "POST",
      url: "/accounts",
      headers: { Authorization: `Bearer ${token}` },
      payload: { name: "Conta B", type: "checking_account" },
    });

    const response = await app.inject({
      method: "PUT",
      url: `/accounts/${second.json().id}`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { isPrimary: true },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().isPrimary).toBe(true);

    const list = await app.inject({
      method: "GET",
      url: "/accounts",
      headers: { Authorization: `Bearer ${token}` },
    });

    const accounts = list.json();
    const primaryAccounts = accounts.filter((acc: any) => acc.isPrimary === true);

    expect(primaryAccounts.length).toBe(1);
    expect(primaryAccounts[0].id).toBe(second.json().id);
  });

  it("não deve permitir desmarcar a única conta principal", async () => {
    const token = await registerAndLogin();

    const created = await app.inject({
      method: "POST",
      url: "/accounts",
      headers: { Authorization: `Bearer ${token}` },
      payload: { name: "Conta Unica", type: "cash" },
    });

    const response = await app.inject({
      method: "PUT",
      url: `/accounts/${created.json().id}`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { isPrimary: false },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().title).toBe("Conflict");
  });

  it("deve definir conta principal via endpoint dedicado", async () => {
    const token = await registerAndLogin();

    const first = await app.inject({
      method: "POST",
      url: "/accounts",
      headers: { Authorization: `Bearer ${token}` },
      payload: { name: "Conta A", type: "cash" },
    });

    const second = await app.inject({
      method: "POST",
      url: "/accounts",
      headers: { Authorization: `Bearer ${token}` },
      payload: { name: "Conta B", type: "checking_account" },
    });

    const response = await app.inject({
      method: "PUT",
      url: `/accounts/${second.json().id}/primary`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().isPrimary).toBe(true);

    const list = await app.inject({
      method: "GET",
      url: "/accounts",
      headers: { Authorization: `Bearer ${token}` },
    });

    const accounts = list.json();
    const primaryAccounts = accounts.filter((acc: any) => acc.isPrimary === true);

    expect(primaryAccounts.length).toBe(1);
    expect(primaryAccounts[0].id).toBe(second.json().id);
    expect(primaryAccounts[0].id).not.toBe(first.json().id);
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

    const body = response.json();
    expect(body.title).toBe("Forbidden");
    expect(body.status).toBe(403);
    expect(body.detail).toBe("Você não tem acesso a esta conta.");
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

    const body = response.json();
    expect(body.title).toBe("Not Found");
    expect(body.status).toBe(404);
    expect(body.detail).toBe("Conta não encontrada.");
  });

  it("deve retornar 401 sem token", async () => {
    const response = await app.inject({
      method: "PUT",
      url: `/accounts/qualquer`,
      payload: { name: "Teste" },
    });

    expect(response.statusCode).toBe(401);

    const body = response.json();
    expect(body.title).toBe("Unauthorized");
    expect(body.status).toBe(401);
  });
});
