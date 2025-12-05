// test/categories/category.test.ts
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { DB } from "../../src/core/plugins/drizzle-test";
import { buildTestApp } from "../setup";
import { accounts, categories, subcategories, transactions, users } from "@/db/schema";

let app: FastifyInstance;
let db: DB;

async function registerAndLogin(email = "user@test.com") {
  await app.inject({
    method: "POST",
    url: "/auth/register",
    headers: { "Content-Type": "application/json" },
    payload: {
      name: "User Test",
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

  const { accessToken } = login.json();
  const [user] = await db.select().from(users).where(eq(users.email, email));

  return { token: accessToken, user };
}

describe("Categories module", () => {
  beforeEach(async () => {
    const built = await buildTestApp();
    app = built.app;
    db = built.db;

    // limpa tudo que pode ter FK
    await db.delete(transactions);
    await db.delete(subcategories);
    await db.delete(categories);
    await db.delete(accounts);
    await db.delete(users);
  });

  afterEach(async () => {
    await app.close();
  });

  // ---------- CREATE ----------
  it("deve criar uma categoria com sucesso", async () => {
    const { token, user } = await registerAndLogin();

    const response = await app.inject({
      method: "POST",
      url: "/categories",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      payload: {
        name: "Alimentação",
        type: "expense",
      },
    });

    expect(response.statusCode).toBe(201);

    const body = response.json();
    expect(body).toMatchObject({
      name: "Alimentação",
      type: "expense",
      userId: user.id,
    });
  });

  it("deve retornar 400 ao tentar criar categoria com payload inválido", async () => {
    const { token } = await registerAndLogin();

    const response = await app.inject({
      method: "POST",
      url: "/categories",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      payload: {
        // name faltando
        type: "expense",
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it("deve retornar 401 ao criar categoria sem token", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/categories",
      payload: {
        name: "Sem Token",
        type: "income",
      },
    });

    expect(response.statusCode).toBe(401);
  });

  // ---------- LIST ----------
  it("deve listar apenas categorias do usuário autenticado", async () => {
    const { token: tokenA, user: userA } = await registerAndLogin("userA@test.com");
    const { token: tokenB, user: userB } = await registerAndLogin("userB@test.com");

    // categorias do user A
    await app.inject({
      method: "POST",
      url: "/categories",
      headers: { Authorization: `Bearer ${tokenA}`, "Content-Type": "application/json" },
      payload: { name: "Salário", type: "income" },
    });

    // categorias do user B
    await app.inject({
      method: "POST",
      url: "/categories",
      headers: { Authorization: `Bearer ${tokenB}`, "Content-Type": "application/json" },
      payload: { name: "Alimentação", type: "expense" },
    });

    const responseA = await app.inject({
      method: "GET",
      url: "/categories",
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    expect(responseA.statusCode).toBe(200);
    const listA = responseA.json();

    expect(Array.isArray(listA)).toBe(true);
    expect(listA.length).toBe(1);
    expect(listA[0].userId).toBe(userA.id);

    const responseB = await app.inject({
      method: "GET",
      url: "/categories",
      headers: { Authorization: `Bearer ${tokenB}` },
    });

    const listB = responseB.json();
    expect(listB.length).toBe(1);
    expect(listB[0].userId).toBe(userB.id);
  });

  // ---------- GET /:id ----------
  it("deve obter categoria por id com sucesso", async () => {
    const { token, user } = await registerAndLogin();

    const created = await app.inject({
      method: "POST",
      url: "/categories",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      payload: { name: "Transporte", type: "expense" },
    });

    const category = created.json();

    const response = await app.inject({
      method: "GET",
      url: `/categories/${category.id}`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toMatchObject({
      id: category.id,
      name: "Transporte",
      type: "expense",
      userId: user.id,
    });
  });

  it("deve retornar 404 ao buscar categoria inexistente", async () => {
    const { token } = await registerAndLogin();

    const response = await app.inject({
      method: "GET",
      url: "/categories/00000000-0000-0000-0000-000000000000",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(404);
  });

  it("deve retornar 403 ao tentar acessar categoria de outro usuário", async () => {
    const { token: tokenA } = await registerAndLogin("userA@test.com");
    const { token: tokenB } = await registerAndLogin("userB@test.com");

    const created = await app.inject({
      method: "POST",
      url: "/categories",
      headers: { Authorization: `Bearer ${tokenA}`, "Content-Type": "application/json" },
      payload: { name: "Saúde", type: "expense" },
    });

    const category = created.json();

    const response = await app.inject({
      method: "GET",
      url: `/categories/${category.id}`,
      headers: { Authorization: `Bearer ${tokenB}` },
    });

    expect(response.statusCode).toBe(403);
  });

  // ---------- UPDATE ----------
  it("deve atualizar categoria do próprio usuário", async () => {
    const { token } = await registerAndLogin();

    const created = await app.inject({
      method: "POST",
      url: "/categories",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      payload: { name: "Antigo Nome", type: "income" },
    });

    const category = created.json();

    const response = await app.inject({
      method: "PUT",
      url: `/categories/${category.id}`,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      payload: { name: "Novo Nome" },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.name).toBe("Novo Nome");
    expect(body.type).toBe("income");
  });

  it("deve retornar 404 ao atualizar categoria inexistente", async () => {
    const { token } = await registerAndLogin();

    const response = await app.inject({
      method: "PUT",
      url: "/categories/00000000-0000-0000-0000-000000000000",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      payload: { name: "Qualquer" },
    });

    expect(response.statusCode).toBe(404);
  });

  it("deve retornar 403 ao atualizar categoria de outro usuário", async () => {
    const { token: tokenA } = await registerAndLogin("userA@test.com");
    const { token: tokenB } = await registerAndLogin("userB@test.com");

    const created = await app.inject({
      method: "POST",
      url: "/categories",
      headers: { Authorization: `Bearer ${tokenA}`, "Content-Type": "application/json" },
      payload: { name: "Saúde", type: "expense" },
    });

    const category = created.json();

    const response = await app.inject({
      method: "PUT",
      url: `/categories/${category.id}`,
      headers: { Authorization: `Bearer ${tokenB}`, "Content-Type": "application/json" },
      payload: { name: "Tentativa inválida" },
    });

    expect(response.statusCode).toBe(403);
  });

  it("deve retornar 400 se body de update estiver vazio", async () => {
    const { token } = await registerAndLogin();

    const created = await app.inject({
      method: "POST",
      url: "/categories",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      payload: { name: "Teste", type: "expense" },
    });

    const category = created.json();

    const response = await app.inject({
      method: "PUT",
      url: `/categories/${category.id}`,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      payload: {},
    });

    expect(response.statusCode).toBe(400);
  });

  // ---------- DELETE ----------
  it("deve remover categoria sem subcategorias", async () => {
    const { token } = await registerAndLogin();

    const created = await app.inject({
      method: "POST",
      url: "/categories",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      payload: { name: "Apagar", type: "expense" },
    });

    const category = created.json();

    const response = await app.inject({
      method: "DELETE",
      url: `/categories/${category.id}`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().message).toBe("Categoria removida com sucesso.");
  });

  it("não deve remover categoria com subcategorias (409)", async () => {
    const { token } = await registerAndLogin();

    const created = await app.inject({
      method: "POST",
      url: "/categories",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      payload: { name: "Saúde", type: "expense" },
    });

    const category = created.json();

    // cria subcategoria via rota
    await app.inject({
      method: "POST",
      url: "/subcategories",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      payload: { categoryId: category.id, name: "Medicamentos" },
    });

    const response = await app.inject({
      method: "DELETE",
      url: `/categories/${category.id}`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().message).toContain("subcategorias");
  });

  it("deve retornar 404 ao deletar categoria inexistente", async () => {
    const { token } = await registerAndLogin();

    const response = await app.inject({
      method: "DELETE",
      url: "/categories/00000000-0000-0000-0000-000000000000",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(404);
  });

  it("deve retornar 403 ao deletar categoria de outro usuário", async () => {
    const { token: tokenA } = await registerAndLogin("userA@test.com");
    const { token: tokenB } = await registerAndLogin("userB@test.com");

    const created = await app.inject({
      method: "POST",
      url: "/categories",
      headers: { Authorization: `Bearer ${tokenA}`, "Content-Type": "application/json" },
      payload: { name: "Categoria A", type: "income" },
    });

    const category = created.json();

    const response = await app.inject({
      method: "DELETE",
      url: `/categories/${category.id}`,
      headers: { Authorization: `Bearer ${tokenB}` },
    });

    expect(response.statusCode).toBe(403);
  });
});
