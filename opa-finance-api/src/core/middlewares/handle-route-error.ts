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

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error: unknown, req, reply) => {
    console.error("❌ ERROR:", error);

    const err = error instanceof Error ? error : new Error("Unknown error");
    const msg = err.message ?? "";

    /* -------------------------------------------------------------
     * 1. RFC7807 custom errors (HttpProblem)
     * ----------------------------------------------------------- */
    if (err instanceof HttpProblem) {
      return reply.status(err.status).send(err.toJSON());
    }

    /* -------------------------------------------------------------
     * 2. ZOD validation error (body, params, etc.)
     * ----------------------------------------------------------- */
    if (err instanceof ZodError) {
      const detail = err.issues.map((i) => i.message).join("; ");
      return reply.status(400).send(new ValidationProblem(detail, req.url).toJSON());
    }

    /* -------------------------------------------------------------
     * 3. Legacy-style string matching (compatibility)
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
     * 4. DEFAULT → INTERNAL ERROR (500)
     * ----------------------------------------------------------- */
    return reply.status(500).send(new InternalProblem(msg || "Erro interno", req.url).toJSON());
  });
}
