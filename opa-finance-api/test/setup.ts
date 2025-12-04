// test/setup.ts
import cookie from "@fastify/cookie";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";

import { createTestDB, DB } from "../src/core/plugins/drizzle-test";
import jwtPlugin from "../src/core/plugins/jwt";
import { accountRoutes } from "@/modules/accounts/account.routes";
import { authRoutes } from "@/modules/auth/auth.routes";
import { categoryRoutes } from "@/modules/categories/category.routes";
import { userRoutes } from "@/modules/users/user.routes";

export async function buildTestApp(): Promise<{ app: FastifyInstance; db: DB }> {
  const app: FastifyInstance = Fastify();

  // Banco de teste (Postgres em memória ou isolado)
  const db: DB = await createTestDB();

  // 🔥 Injeta o banco de teste na instância, igual no server real
  app.decorate("db", db);

  // 🔥 Cookie PRECISA vir antes do JWT plugin
  app.register(cookie, {
    secret: "test-secret", // pode ser qualquer valor nos testes
  });

  // JWT plugin (depende do cookie para ler o refreshToken)
  app.register(jwtPlugin);

  // 🔥 Parser JSON idêntico ao ambiente real
  app.addContentTypeParser("application/json", { parseAs: "buffer" }, (req, body, done) => {
    try {
      const str = body ? body.toString() : "{}";
      const json = JSON.parse(str);
      done(null, json);
    } catch (err) {
      done(err as Error);
    }
  });

  // Rotas
  app.register(authRoutes);
  app.register(userRoutes);
  app.register(accountRoutes);
  app.register(categoryRoutes);

  // Inicializa Fastify
  await app.ready();

  return { app, db };
}
