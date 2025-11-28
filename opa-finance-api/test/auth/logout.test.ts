import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { FastifyInstance } from "fastify";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { hashPassword } from "../../src/core/utils/hash.utils";
import { users } from "../../src/db/schema";
import * as schema from "../../src/db/schema";
import { buildTestApp } from "../setup";

let app: FastifyInstance;
let db: NodePgDatabase<typeof schema>;

describe.sequential("Rota /auth/logout", () => {
  beforeEach(async () => {
    const built = await buildTestApp();
    app = built.app;
    db = built.db;

    // limpa tabela
    await db.delete(users);
  });

  afterEach(async () => {
    await app.close();
  });

  it("deve limpar o refreshToken e retornar mensagem de sucesso", async () => {
    // cria usuário
    await db.insert(users).values({
      name: "Bruno",
      email: "bruno@example.com",
      passwordHash: await hashPassword("Aa123456!"),
    });

    // login gera refresh token
    const loginResponse = await app.inject({
      method: "POST",
      url: "/auth/login",
      headers: { "Content-Type": "application/json" },
      payload: {
        email: "bruno@example.com",
        password: "Aa123456!",
      },
    });

    const cookie = loginResponse.cookies.find((c) => c.name === "refreshToken");
    expect(cookie).toBeDefined();

    // logout
    const response = await app.inject({
      method: "POST",
      url: "/auth/logout",
      cookies: {
        refreshToken: cookie!.value,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().message).toBe("Logout realizado com sucesso.");

    const cleared = response.cookies.find((c) => c.name === "refreshToken");
    expect(cleared).toBeDefined();
    expect(cleared!.value).toBe("");
    expect(typeof cleared!.expires).toBe("object");
  });

  it("deve funcionar mesmo sem cookie de refresh", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/logout",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().message).toBe("Logout realizado com sucesso.");
  });
});
