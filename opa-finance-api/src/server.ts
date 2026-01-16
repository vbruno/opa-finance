import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type Ajv from "ajv";
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
import { transferRoutes } from "./modules/transfers/transfer.routes";
import { userRoutes } from "./modules/users/user.routes";

config();

async function start() {
  const app = Fastify({
    logger:
      env.NODE_ENV === "production"
        ? {
            level: env.LOG_LEVEL ?? "info",
          }
        : false,
    ajv: {
      plugins: [
        (ajv: Ajv) => {
          ajv.addKeyword({
            keyword: "example",
            schemaType: ["string", "number", "boolean", "object", "array"],
          });
        },
      ],
    },
  });

  // CORS
  const corsOrigins =
    env.CORS_ORIGINS?.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean) ?? [];
  const corsOrigin = env.NODE_ENV === "development" ? true : corsOrigins;
  app.register(cors, {
    origin: corsOrigin,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Set-Cookie"],
  });

  // Cookies
  app.register(cookie, {
    secret: env.JWT_SECRET,
  });

  if (env.NODE_ENV !== "production") {
    app.register(swagger, {
      openapi: {
        info: {
          title: "OPA Finance API",
          version: "1.0.0",
          description: "API para controle financeiro com autenticação JWT e cookies.",
        },
        servers: [
          { url: "http://localhost:3333", description: "Development" },
          { url: "https://api.seudominio.com", description: "Production" },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
              bearerFormat: "JWT",
            },
          },
        },
      },
    });
    app.register(swaggerUi, {
      routePrefix: "/docs",
    });
  }

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
  app.register(transferRoutes);

  // **⚠️ Último passo: registrar o handler global de erros**
  registerErrorHandler(app);

  // Rota simples
  app.get("/", () => {
    return { message: "API funcionando!" };
  });

  await app.listen({ port: Number(env.PORT), host: env.HOST });

  console.log(`🔥 API running on http://${env.HOST}:${env.PORT}`);
}

start();
