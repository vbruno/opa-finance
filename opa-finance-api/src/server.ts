import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import { config } from "dotenv";
import Fastify from "fastify";
import { env } from "./core/config/env";
import { db } from "./core/plugins/drizzle";
import jwtPlugin from "./core/plugins/jwt";
import { accountRoutes } from "./modules/accounts/account.routes";
import { authRoutes } from "./modules/auth/auth.routes";
import { categoryRoutes } from "./modules/categories/category.routes";
import { userRoutes } from "./modules/users/user.routes";

config();

async function start() {
  const app = Fastify();

  // CORS
  app.register(cors, { origin: true });

  // 🔥 Cookie precisa vir ANTES do JWT plugin
  app.register(cookie, {
    secret: env.JWT_SECRET,
  });

  // 🔥 Injeta o banco real usando Drizzle
  app.decorate("db", db);

  // JWT (usa cookies já instalados)
  app.register(jwtPlugin);

  // Parser JSON idêntico ao usado nos testes
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

  // Rota teste
  app.get("/", () => {
    return { message: "API funcionando!" };
  });

  await app.listen({ port: Number(env.PORT) });

  console.log("🔥 Server rodando na porta", env.PORT);
}

start();
