// test/account/delete-account.test.ts
import { eq } from "drizzle-orm";
import { FastifyInstance } from "fastify";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resetTables } from "../helpers/resetTables";
import { buildTestApp } from "../setup";
import { transactions, users, categories } from "@/db/schema";

let app: FastifyInstance;
let db: any;

// helper para registrar + logar
async function registerAndLogin() {
  await app.inject({
    method: "POST",
    url: "/auth/register",
    headers: { "Content-Type": "application/json" },
    payload: {
      name: "User",
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

  const { accessToken } = login.json();
  const [user] = await db.select().from(users).where(eq(users.email, "user@test.com"));

  return { token: accessToken, userId: user.id };
}

describe.sequential("DELETE /accounts/:id", () => {
  beforeEach(async () => {
    const built = await buildTestApp();
    app = built.app;
    db = built.db;

    await resetTables(built.db);
  });

  afterEach(async () => {
    await app.close();
  });

  it("deve remover conta com sucesso", async () => {
    const { token } = await registerAndLogin();

    const created = await app.inject({
      method: "POST",
      url: "/accounts",
      headers: { Authorization: `Bearer ${token}` },
      payload: { name: "Conta", type: "cash" },
    });

    const account = created.json();

    const second = await app.inject({
      method: "POST",
      url: "/accounts",
      headers: { Authorization: `Bearer ${token}` },
      payload: { name: "Conta Secundaria", type: "checking_account", isPrimary: true },
    });

    expect(second.statusCode).toBe(201);

    const response = await app.inject({
      method: "DELETE",
      url: `/accounts/${account.id}`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().message).toBe("Conta removida com sucesso.");
  });

  it("não deve permitir remover conta com transações", async () => {
    const { token, userId } = await registerAndLogin();

    const created = await app.inject({
      method: "POST",
      url: "/accounts",
      headers: { Authorization: `Bearer ${token}` },
      payload: { name: "Conta X", type: "cash" },
    });

    const account = created.json();

    const second = await app.inject({
      method: "POST",
      url: "/accounts",
      headers: { Authorization: `Bearer ${token}` },
      payload: { name: "Conta Secundaria", type: "checking_account", isPrimary: true },
    });

    expect(second.statusCode).toBe(201);

    // categoria necessária
    const [category] = await db
      .insert(categories)
      .values({
        userId,
        name: "Categoria Teste",
        type: "expense",
      })
      .returning();

    // cria transação vinculada à conta
    await db.insert(transactions).values({
      userId,
      accountId: account.id,
      categoryId: category.id,
      type: "expense",
      amount: "10.00",
      date: "2025-01-01",
    });

    const response = await app.inject({
      method: "DELETE",
      url: `/accounts/${account.id}`,
      headers: { Authorization: `Bearer ${token}` },
    });

    const body = response.json();

    expect(response.statusCode).toBe(409);
    expect(body.title).toBe("Conflict");
    expect(body.status).toBe(409);
    expect(body.detail).toContain("transações");
  });

  it("não deve permitir remover a conta principal", async () => {
    const { token } = await registerAndLogin();

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
      method: "DELETE",
      url: `/accounts/${first.json().id}`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().title).toBe("Conflict");
    expect(response.json().detail).toContain("conta principal");
  });

  it("deve retornar 404 para conta inexistente", async () => {
    const { token } = await registerAndLogin();

    const response = await app.inject({
      method: "DELETE",
      url: `/accounts/00000000-0000-0000-0000-000000000000`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(404);

    const body = response.json();
    expect(body.title).toBe("Not Found");
    expect(body.status).toBe(404);
    expect(body.detail).toBe("Conta não encontrada.");
  });

  it("não deve permitir remover a única conta principal", async () => {
    const { token } = await registerAndLogin();

    const created = await app.inject({
      method: "POST",
      url: "/accounts",
      headers: { Authorization: `Bearer ${token}` },
      payload: { name: "Conta Unica", type: "cash" },
    });

    const response = await app.inject({
      method: "DELETE",
      url: `/accounts/${created.json().id}`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().title).toBe("Conflict");
    expect(response.json().detail).toContain("conta principal");
  });
});
