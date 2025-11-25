import { eq } from "drizzle-orm";
import { describe, it, expect, beforeEach } from "vitest";
import { users } from "../../src/db/schema";
import { app, db } from "../setup";

describe("Registro de usuário", () => {
  beforeEach(async () => {
    await db.delete(users);
  });

  it("deve registrar um usuário com sucesso", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      headers: { "Content-Type": "application/json" },
      payload: {
        name: "Bruno",
        email: "bruno@example.com",
        password: "Aa123456!",
        confirmPassword: "Aa123456!",
      },
    });

    expect(response.statusCode).toBe(201);

    const body = response.json();
    expect(body).toHaveProperty("accessToken");
    // garante que o usuário realmente foi criado no banco
    const result = await db.select().from(users).where(eq(users.email, "bruno@example.com"));

    expect(result.length).toBe(1);
  });

  it("deve falhar se o email já estiver cadastrado", async () => {
    await db.insert(users).values({
      name: "Bruno",
      email: "bruno@example.com",
      passwordHash: "hash",
    });

    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      headers: { "Content-Type": "application/json" },
      payload: {
        name: "Bruno",
        email: "bruno@example.com",
        password: "Aa123456!",
        confirmPassword: "Aa123456!",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().message).toBe("E-mail já cadastrado.");
  });

  it("deve falhar se as senhas não coincidirem", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      headers: { "Content-Type": "application/json" },
      payload: {
        name: "Bruno",
        email: "bruno@example.com",
        password: "Aa123456!",
        confirmPassword: "OutraSenha!",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toHaveProperty("message");
  });

  it("deve falhar se a senha for fraca", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      headers: { "Content-Type": "application/json" },
      payload: {
        name: "Bruno",
        email: "bruno@example.com",
        password: "123",
        confirmPassword: "123",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toHaveProperty("message");
  });

  it("deve falhar com email inválido", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      headers: { "Content-Type": "application/json" },
      payload: {
        name: "Bruno",
        email: "abc",
        password: "Aa123456!",
        confirmPassword: "Aa123456!",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toHaveProperty("message");
  });

  it("deve falhar se o nome for muito curto", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      headers: { "Content-Type": "application/json" },
      payload: {
        name: "B",
        email: "bruno@example.com",
        password: "Aa123456!",
        confirmPassword: "Aa123456!",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toHaveProperty("message");
  });

  it("deve falhar se faltarem campos obrigatórios", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      headers: { "Content-Type": "application/json" },
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toHaveProperty("message");
  });
});
