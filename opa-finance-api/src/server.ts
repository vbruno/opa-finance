import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import { config } from "dotenv";
import Fastify from "fastify";
import { env } from "./core/config/env";
import { registerErrorHandler } from "./core/middlewares/handle-route-error";
import { db } from "./core/plugins/drizzle";
import jwtPlugin from "./core/plugins/jwt";

import { accountRoutes } from "./modules/accounts/account.routes";
import { authRoutes } from "./modules/auth/auth.routes";
import { categoryRoutes } from "./modules/categories/category.routes";
import { transactionRoutes } from "./modules/transactions/transaction.routes";
import { userRoutes } from "./modules/users/user.routes";

config();

async function start() {
  const app = Fastify({
    logger: false,
  });

  // CORS
  app.register(cors, { origin: true });

  // Cookies
  app.register(cookie, {
    secret: env.JWT_SECRET,
  });

  // Banco real (Drizzle)
  app.decorate("db", db);

  // JWT Plugin
  app.register(jwtPlugin);

  // JSON parser igual aos testes
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
  app.register(transactionRoutes);

  // **⚠️ Último passo: registrar o handler global de erros**
  registerErrorHandler(app);

  // Rota simples
  app.get("/", () => {
    return { message: "API funcionando!" };
  });

  await app.listen({ port: Number(env.PORT) });

  console.log("🔥 Server rodando na porta", env.PORT);
}

start();
