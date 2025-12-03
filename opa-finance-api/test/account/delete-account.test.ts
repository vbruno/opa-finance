import { eq } from "drizzle-orm";
import { FastifyInstance } from "fastify";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resetTables } from "../helpers/resetTables";
import { buildTestApp } from "../setup";
import { transactions, users, categories } from "@/db/schema";

let app: FastifyInstance;
let db: any;

// função helper de login
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

describe("DELETE /accounts/:id", () => {
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

    const response = await app.inject({
      method: "DELETE",
      url: `/accounts/${account.id}`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
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

    // categoria válida
    const [category] = await db
      .insert(categories)
      .values({
        userId,
        name: "Categoria Teste",
        type: "expense",
      })
      .returning();

    // transação válida
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

    expect(response.statusCode).toBe(409);
    expect(response.json().message).toContain("transações");
  });

  it("deve retornar 404 para conta inexistente", async () => {
    const { token } = await registerAndLogin();

    const response = await app.inject({
      method: "DELETE",
      url: `/accounts/00000000-0000-0000-0000-000000000000`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(404);
  });
});
