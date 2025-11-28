// test/setup.ts
import cookie from "@fastify/cookie";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";

import { createTestDB } from "../src/core/plugins/drizzle-test";
import jwtPlugin from "../src/core/plugins/jwt";
import { authRoutes } from "../src/modules/auth/auth.routes";

export async function buildTestApp() {
  const app: FastifyInstance = Fastify();

  // Banco de teste (Postgres em memória ou isolado)
  const db = await createTestDB();

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

  // Inicializa Fastify
  await app.ready();

  return { app, db };
}
