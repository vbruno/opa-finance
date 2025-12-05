// test/categories/subcategory.test.ts
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

describe("Subcategories module", () => {
  beforeEach(async () => {
    const built = await buildTestApp();
    app = built.app;
    db = built.db;

    await db.delete(transactions);
    await db.delete(subcategories);
    await db.delete(categories);
    await db.delete(accounts);
    await db.delete(users);
  });

  afterEach(async () => {
    await app.close();
  });

  async function createCategoryForUser(
    token: string,
    name = "Saúde",
    type: "income" | "expense" = "expense",
  ) {
    const response = await app.inject({
      method: "POST",
      url: "/categories",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      payload: { name, type },
    });

    return response.json();
  }

  // ---------- CREATE ----------
  it("deve criar subcategoria com sucesso herdando o tipo da categoria", async () => {
    const { token, user } = await registerAndLogin();

    const category = await createCategoryForUser(token, "Saúde", "expense");

    const response = await app.inject({
      method: "POST",
      url: "/subcategories",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      payload: { categoryId: category.id, name: "Medicamentos" },
    });

    expect(response.statusCode).toBe(201);

    const body = response.json();
    // a subcategoria não possui mais o campo "type" diretamente
    expect(body).toMatchObject({
      name: "Medicamentos",
      categoryId: category.id,
      userId: user.id,
    });

    // valida que o tipo herdado continua correto na categoria relacionada
    const [dbCategory] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, body.categoryId));

    expect(dbCategory.type).toBe("expense");
  });

  it("deve retornar 404 ao criar subcategoria para categoria inexistente", async () => {
    const { token } = await registerAndLogin();

    const response = await app.inject({
      method: "POST",
      url: "/subcategories",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      payload: {
        categoryId: "00000000-0000-0000-0000-000000000000",
        name: "Qualquer",
      },
    });

    expect(response.statusCode).toBe(404);
  });

  it("deve retornar 403 ao criar subcategoria em categoria de outro usuário", async () => {
    const { token: tokenA } = await registerAndLogin("userA@test.com");
    const { token: tokenB } = await registerAndLogin("userB@test.com");

    const categoryA = await createCategoryForUser(tokenA, "Investimentos", "income");

    const response = await app.inject({
      method: "POST",
      url: "/subcategories",
      headers: { Authorization: `Bearer ${tokenB}`, "Content-Type": "application/json" },
      payload: {
        categoryId: categoryA.id,
        name: "Tesouro Direto",
      },
    });

    expect(response.statusCode).toBe(403);
  });

  // ---------- LIST BY CATEGORY ----------
  it("deve listar subcategorias de uma categoria do usuário", async () => {
    const { token } = await registerAndLogin();

    const category = await createCategoryForUser(token, "Alimentação", "expense");

    const sub1 = await app.inject({
      method: "POST",
      url: "/subcategories",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      payload: { categoryId: category.id, name: "Restaurantes" },
    });

    const sub2 = await app.inject({
      method: "POST",
      url: "/subcategories",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      payload: { categoryId: category.id, name: "Mercado" },
    });

    expect(sub1.statusCode).toBe(201);
    expect(sub2.statusCode).toBe(201);

    const response = await app.inject({
      method: "GET",
      url: `/categories/${category.id}/subcategories`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const list = response.json();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBe(2);
    const names = list.map((s: any) => s.name).sort();
    expect(names).toEqual(["Mercado", "Restaurantes"]);
  });

  it("deve retornar 404 ao listar subcategorias de categoria inexistente", async () => {
    const { token } = await registerAndLogin();

    const response = await app.inject({
      method: "GET",
      url: "/categories/00000000-0000-0000-0000-000000000000/subcategories",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(404);
  });

  it("deve retornar 403 ao listar subcategorias de categoria de outro usuário", async () => {
    const { token: tokenA } = await registerAndLogin("userA@test.com");
    const { token: tokenB } = await registerAndLogin("userB@test.com");

    const categoryA = await createCategoryForUser(tokenA, "Lazer", "expense");

    const response = await app.inject({
      method: "GET",
      url: `/categories/${categoryA.id}/subcategories`,
      headers: { Authorization: `Bearer ${tokenB}` },
    });

    expect(response.statusCode).toBe(403);
  });

  // ---------- GET /subcategories/:id ----------
  it("deve obter subcategoria por id com sucesso", async () => {
    const { token } = await registerAndLogin();

    const category = await createCategoryForUser(token, "Casa", "expense");

    const created = await app.inject({
      method: "POST",
      url: "/subcategories",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      payload: { categoryId: category.id, name: "Aluguel" },
    });

    const sub = created.json();

    const response = await app.inject({
      method: "GET",
      url: `/subcategories/${sub.id}`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.id).toBe(sub.id);
    expect(body.name).toBe("Aluguel");
  });

  it("deve retornar 404 ao buscar subcategoria inexistente", async () => {
    const { token } = await registerAndLogin();

    const response = await app.inject({
      method: "GET",
      url: "/subcategories/00000000-0000-0000-0000-000000000000",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(404);
  });

  it("deve retornar 403 ao buscar subcategoria de outro usuário", async () => {
    const { token: tokenA } = await registerAndLogin("userA@test.com");
    const { token: tokenB } = await registerAndLogin("userB@test.com");

    const categoryA = await createCategoryForUser(tokenA, "Viagem", "expense");

    const created = await app.inject({
      method: "POST",
      url: "/subcategories",
      headers: { Authorization: `Bearer ${tokenA}`, "Content-Type": "application/json" },
      payload: { categoryId: categoryA.id, name: "Passagens" },
    });

    const sub = created.json();

    const response = await app.inject({
      method: "GET",
      url: `/subcategories/${sub.id}`,
      headers: { Authorization: `Bearer ${tokenB}` },
    });

    expect(response.statusCode).toBe(403);
  });

  // ---------- UPDATE ----------
  it("deve atualizar subcategoria do próprio usuário", async () => {
    const { token } = await registerAndLogin();

    const category = await createCategoryForUser(token, "Educação", "expense");

    const created = await app.inject({
      method: "POST",
      url: "/subcategories",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      payload: { categoryId: category.id, name: "Cursos" },
    });

    const sub = created.json();

    const response = await app.inject({
      method: "PUT",
      url: `/subcategories/${sub.id}`,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      payload: { name: "Cursos Online" },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.name).toBe("Cursos Online");
  });

  it("deve retornar 404 ao atualizar subcategoria inexistente", async () => {
    const { token } = await registerAndLogin();

    const response = await app.inject({
      method: "PUT",
      url: "/subcategories/00000000-0000-0000-0000-000000000000",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      payload: { name: "Novo Nome" },
    });

    expect(response.statusCode).toBe(404);
  });

  it("deve retornar 403 ao atualizar subcategoria de outro usuário", async () => {
    const { token: tokenA } = await registerAndLogin("userA@test.com");
    const { token: tokenB } = await registerAndLogin("userB@test.com");

    const categoryA = await createCategoryForUser(tokenA, "Saúde", "expense");

    const created = await app.inject({
      method: "POST",
      url: "/subcategories",
      headers: { Authorization: `Bearer ${tokenA}`, "Content-Type": "application/json" },
      payload: { categoryId: categoryA.id, name: "Exames" },
    });

    const sub = created.json();

    const response = await app.inject({
      method: "PUT",
      url: `/subcategories/${sub.id}`,
      headers: { Authorization: `Bearer ${tokenB}`, "Content-Type": "application/json" },
      payload: { name: "Hack" },
    });

    expect(response.statusCode).toBe(403);
  });

  it("deve retornar 400 se body de update estiver vazio", async () => {
    const { token } = await registerAndLogin();

    const category = await createCategoryForUser(token, "Lazer", "expense");

    const created = await app.inject({
      method: "POST",
      url: "/subcategories",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      payload: { categoryId: category.id, name: "Cinema" },
    });

    const sub = created.json();

    const response = await app.inject({
      method: "PUT",
      url: `/subcategories/${sub.id}`,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      payload: {},
    });

    expect(response.statusCode).toBe(400);
  });

  // ---------- DELETE ----------
  it("deve remover subcategoria do próprio usuário", async () => {
    const { token } = await registerAndLogin();

    const category = await createCategoryForUser(token, "Casa", "expense");

    const created = await app.inject({
      method: "POST",
      url: "/subcategories",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      payload: { categoryId: category.id, name: "Luz" },
    });

    const sub = created.json();

    const response = await app.inject({
      method: "DELETE",
      url: `/subcategories/${sub.id}`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().message).toBe("Subcategoria removida com sucesso.");
  });

  it("deve retornar 404 ao deletar subcategoria inexistente", async () => {
    const { token } = await registerAndLogin();

    const response = await app.inject({
      method: "DELETE",
      url: "/subcategories/00000000-0000-0000-0000-000000000000",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(404);
  });

  it("deve retornar 403 ao deletar subcategoria de outro usuário", async () => {
    const { token: tokenA } = await registerAndLogin("userA@test.com");
    const { token: tokenB } = await registerAndLogin("userB@test.com");

    const categoryA = await createCategoryForUser(tokenA, "Outros", "expense");

    const created = await app.inject({
      method: "POST",
      url: "/subcategories",
      headers: { Authorization: `Bearer ${tokenA}`, "Content-Type": "application/json" },
      payload: { categoryId: categoryA.id, name: "Diversos" },
    });

    const sub = created.json();

    const response = await app.inject({
      method: "DELETE",
      url: `/subcategories/${sub.id}`,
      headers: { Authorization: `Bearer ${tokenB}` },
    });

    expect(response.statusCode).toBe(403);
  });
});
