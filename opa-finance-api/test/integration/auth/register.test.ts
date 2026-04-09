import type { FastifyInstance } from "fastify";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema";
import { buildTestApp } from "../setup";

let app: FastifyInstance;

beforeEach(async () => {
  const built = await buildTestApp();
  app = built.app;
});

afterEach(async () => {
  await app.close();
});

describe("Registro de usuário", () => {
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
    expect(response.json()).toHaveProperty("accessToken");
  });

  it("deve falhar ao tentar registrar email duplicado", async () => {
    await app.inject({
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

    expect(response.statusCode).toBe(409);

    const body = response.json();
    expect(body.title).toBe("Conflict");
    expect(body.detail).toBe("E-mail já cadastrado.");
  });

  it("deve aceitar timezone válido no cadastro", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      headers: { "Content-Type": "application/json" },
      payload: {
        name: "Bruno",
        email: "timezone-ok@example.com",
        timezone: "America/Sao_Paulo",
        password: "Aa123456!",
        confirmPassword: "Aa123456!",
      },
    });

    expect(response.statusCode).toBe(201);

    const [created] = await app.db
      .select({ timezone: users.timezone })
      .from(users)
      .where(eq(users.email, "timezone-ok@example.com"));

    expect(created?.timezone).toBe("America/Sao_Paulo");
  });

  it("deve aplicar timezone padrão quando timezone não for informado", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      headers: { "Content-Type": "application/json" },
      payload: {
        name: "Bruno",
        email: "timezone-default@example.com",
        password: "Aa123456!",
        confirmPassword: "Aa123456!",
      },
    });

    expect(response.statusCode).toBe(201);

    const [created] = await app.db
      .select({ timezone: users.timezone })
      .from(users)
      .where(eq(users.email, "timezone-default@example.com"));

    expect(created?.timezone).toBe("Australia/Adelaide");
  });

  it("deve retornar 400 para timezone inválido no cadastro", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      headers: { "Content-Type": "application/json" },
      payload: {
        name: "Bruno",
        email: "timezone-invalid@example.com",
        timezone: "Invalid/Timezone",
        password: "Aa123456!",
        confirmPassword: "Aa123456!",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().detail).toBe("Timezone inválido.");
  });
});
