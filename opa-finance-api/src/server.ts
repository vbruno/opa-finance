import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type Ajv from "ajv";
import { config } from "dotenv";
import { sql } from "drizzle-orm";
import Fastify from "fastify";
import { env } from "./core/config/env";
import { TooManyRequestsProblem } from "./core/errors/problems";
import { registerErrorHandler } from "./core/middlewares/handle-route-error";
import { db } from "./core/plugins/drizzle";
import jwtPlugin from "./core/plugins/jwt";
import { unaccentPlugin } from "./core/plugins/unaccent";

import { accountRoutes } from "./modules/accounts/account.routes";
import { auditRoutes } from "./modules/audit/audit.routes";
import { authRoutes } from "./modules/auth/auth.routes";
import { categoryRoutes } from "./modules/categories/category.routes";
import { registerRecurrenceDailyJob } from "./modules/recurrences/recurrence-daily-job";
import { recurrenceRoutes } from "./modules/recurrences/recurrence.routes";
import { consolidatedRoutes } from "./modules/reports/consolidated.routes";
import { weeklyCashflowRoutes } from "./modules/reports/weekly-cashflow.routes";
import { systemRoutes } from "./modules/system/system.routes";
import { transactionRoutes } from "./modules/transactions/transaction.routes";
import { transferRoutes } from "./modules/transfers/transfer.routes";
import { userRoutes } from "./modules/users/user.routes";

config();

const DATABASE_BOOT_CHECK_TIMEOUT_MS = 5_000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

async function ensureDatabaseConnection() {
  await withTimeout(
    db.execute(sql`SELECT 1`),
    DATABASE_BOOT_CHECK_TIMEOUT_MS,
    `Database boot check timeout after ${DATABASE_BOOT_CHECK_TIMEOUT_MS}ms`,
  );
}

function buildCorsOrigin(nodeEnv: string, configuredOrigins: string[]) {
  const isDevLike = nodeEnv === "development" || nodeEnv === "test";

  if (isDevLike) {
    return true;
  }

  const sanitized = configuredOrigins.filter((origin) => origin !== "*");
  if (sanitized.length === 0) {
    return false;
  }

  return (origin: string | undefined, callback: (error: Error | null, allow: boolean) => void) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    callback(null, sanitized.includes(origin));
  };
}

async function start() {
  await ensureDatabaseConnection();

  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? (env.LOG_LEVEL ?? "info") : "warn",
    },
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
  const corsOrigin = buildCorsOrigin(env.NODE_ENV, corsOrigins);
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

  // Rate limit (aplicado por rota via config.rateLimit)
  await app.register(rateLimit, {
    global: false,
    hook: "preHandler",
    errorResponseBuilder: (req, context) =>
      new TooManyRequestsProblem(
        `Muitas tentativas. Tente novamente em ${Math.ceil(context.ttl / 1000)}s.`,
        req.url,
      ),
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

  // Verifica extensão unaccent uma vez no boot e decora o app
  app.register(unaccentPlugin);

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
  app.register(auditRoutes);
  app.register(accountRoutes);
  app.register(categoryRoutes);
  app.register(recurrenceRoutes);
  app.register(consolidatedRoutes);
  app.register(weeklyCashflowRoutes);
  app.register(transactionRoutes);
  app.register(transferRoutes);
  app.register(systemRoutes);
  registerRecurrenceDailyJob(app);

  registerErrorHandler(app);

  await app.listen({ port: Number(env.PORT), host: env.HOST });

  console.log(`🔥 API running on http://${env.HOST}:${env.PORT}`);
}

start().catch((error) => {
  console.error("❌ Falha ao iniciar API (checagem de banco ou bootstrap):", error);
  process.exit(1);
});
