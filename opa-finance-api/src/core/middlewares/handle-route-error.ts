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
} from "../errors/problems";

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error: unknown, req, reply) => {
    console.error("❌ ERROR:", error);

    // Garantir que sempre lidamos com Error
    const err = error instanceof Error ? error : new Error("Unknown error");

    /* ----------------------------------------------------------------------
     * 1. ZOD ERROR → 400 RFC7807
     * -------------------------------------------------------------------- */
    if (err instanceof ZodError) {
      const detail = err.issues.map((i) => i.message).join("; ");
      return reply.status(400).send(new ValidationProblem(detail, req.url));
    }

    /* ----------------------------------------------------------------------
     * 2. HttpProblem explícito → já no formato RFC7807
     * -------------------------------------------------------------------- */
    if (err instanceof HttpProblem) {
      return reply.status(err.status).send(err.toJSON());
    }

    /* ----------------------------------------------------------------------
     * 3. Compatibilidade com serviços antigos (mensagens legadas)
     * -------------------------------------------------------------------- */
    const msg = err.message;

    if (msg.includes("não encontrada"))
      return reply.status(404).send(new NotFoundProblem(msg, req.url));

    if (msg.includes("Acesso negado"))
      return reply.status(403).send(new ForbiddenProblem(msg, req.url));

    if (msg.includes("subcategorias") || msg.includes("transações"))
      return reply.status(409).send(new ConflictProblem(msg, req.url));

    /* ----------------------------------------------------------------------
     * 4. INTERNAL ERROR → RFC7807
     * -------------------------------------------------------------------- */
    return reply.status(500).send(new InternalProblem(err.message || "Erro interno", req.url));
  });
}
