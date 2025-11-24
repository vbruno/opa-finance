import cookie from "@fastify/cookie";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { beforeAll, afterAll } from "vitest";
import { env } from "../src/core/config/env";
import { createTestDB } from "../src/core/plugins/drizzle-test";
import jwtPlugin from "../src/core/plugins/jwt";
import { authRoutes } from "../src/modules/auth/auth.routes";

export let app: FastifyInstance;
export let db: any;

beforeAll(async () => {
  db = await createTestDB();

  app = Fastify();

  // injeta o banco de teste (Postgres)
  app.decorate("db", db);

  app.register(cookie, {
    secret: env.JWT_SECRET,
  });

  app.register(jwtPlugin);
  app.register(authRoutes);

  await app.ready();
});

afterAll(async () => {
  if (app) {
    await app.close();
  }
});
