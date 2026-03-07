// src/core/middlewares/handle-route-error.ts
import { FastifyInstance } from "fastify";
import { ZodError } from "zod";

import { HttpProblem } from "../errors/http-problem";
import {
  NotFoundProblem,
  ForbiddenProblem,
  ValidationProblem,
  ConflictProblem,
  InternalProblem,
  UnauthorizedProblem,
} from "../errors/problems";

function isFastifyValidationError(error: Error & { code?: string; statusCode?: number }) {
  return error.code === "FST_ERR_VALIDATION" || error.statusCode === 400;
}

function routeRequiresBearerAuth(req: { routeOptions?: { schema?: { security?: unknown } } }) {
  const security = req.routeOptions?.schema?.security;
  return Array.isArray(security) && security.length > 0;
}

function getRequiredFieldMessage(error: Error & { validation?: unknown }) {
  const validations = Array.isArray((error as { validation?: unknown[] }).validation)
    ? ((error as { validation?: unknown[] }).validation ?? [])
    : [];

  const requiredError = validations.find((issue) => {
    if (!issue || typeof issue !== "object") return false;
    const keyword = (issue as { keyword?: unknown }).keyword;
    return keyword === "required";
  });

  if (!requiredError || typeof requiredError !== "object") return null;

  const missingProperty = (requiredError as { params?: { missingProperty?: unknown } }).params
    ?.missingProperty;

  if (typeof missingProperty !== "string" || missingProperty.length === 0) return null;

  const fieldLabels: Record<string, string> = {
    name: "Nome",
    email: "E-mail",
    password: "Senha",
    confirmPassword: "Confirmação de senha",
    accountId: "Conta",
    fromAccountId: "Conta de origem",
    toAccountId: "Conta de destino",
    categoryId: "Categoria",
    subcategoryId: "Subcategoria",
    type: "Tipo",
    amount: "Valor",
    date: "Data",
    token: "Token",
  };

  const label = fieldLabels[missingProperty] ?? missingProperty;
  return `${label} é obrigatório${label === "Confirmação de senha" ? "a" : ""}.`;
}

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error: unknown, req, reply) => {
    console.error("❌ ERROR:", error);

    const err = error instanceof Error ? error : new Error("Unknown error");
    const msg = err.message ?? "";

    /* -------------------------------------------------------------
     * JWT ERRORS → Unauthorized (FST_JWT_*)
     * ----------------------------------------------------------- */
    if ((err as any).code && String((err as any).code).startsWith("FST_JWT_")) {
      return reply
        .status(401)
        .send(new UnauthorizedProblem("Token ausente ou inválido.", req.url).toJSON());
    }

    /* -------------------------------------------------------------
     * Fastify validation before auth
     * Protected routes validate body/query before preHandler.
     * If bearer auth is required and no token was sent, normalize to 401.
     * ----------------------------------------------------------- */
    if (
      isFastifyValidationError(err as Error & { code?: string; statusCode?: number }) &&
      routeRequiresBearerAuth(req) &&
      !req.headers.authorization
    ) {
      return reply
        .status(401)
        .send(new UnauthorizedProblem("Token ausente ou inválido.", req.url).toJSON());
    }

    /* -------------------------------------------------------------
     * RFC7807 custom errors (HttpProblem)
     * ----------------------------------------------------------- */
    if (err instanceof HttpProblem) {
      return reply.status(err.status).send(err.toJSON());
    }

    /* -------------------------------------------------------------
     * Zod errors → 400
     * ----------------------------------------------------------- */
    if (err instanceof ZodError) {
      const detail = err.issues.map((i) => i.message).join("; ");
      return reply.status(400).send(new ValidationProblem(detail, req.url).toJSON());
    }

    /* -------------------------------------------------------------
     * Fastify/AJV validation errors → 400
     * ----------------------------------------------------------- */
    if (isFastifyValidationError(err as Error & { code?: string; statusCode?: number })) {
      const detail = getRequiredFieldMessage(err as Error & { validation?: unknown }) ?? msg;
      return reply.status(400).send(new ValidationProblem(detail, req.url).toJSON());
    }

    /* -------------------------------------------------------------
     * Legacy messages
     * ----------------------------------------------------------- */
    if (msg.includes("não encontrado") || msg.includes("não encontrada")) {
      return reply.status(404).send(new NotFoundProblem(msg, req.url).toJSON());
    }

    if (msg.includes("Acesso negado")) {
      return reply.status(403).send(new ForbiddenProblem(msg, req.url).toJSON());
    }

    if (msg.includes("conflito") || msg.includes("já cadastrado")) {
      return reply.status(409).send(new ConflictProblem(msg, req.url).toJSON());
    }

    /* -------------------------------------------------------------
     * Default → 500
     * ----------------------------------------------------------- */
    return reply.status(500).send(new InternalProblem(msg || "Erro interno", req.url).toJSON());
  });
}
