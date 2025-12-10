// src/modules/transactions/transaction.routes.ts
import { FastifyInstance } from "fastify";

import {
  createTransactionSchema,
  updateTransactionSchema,
  transactionParamsSchema,
} from "./transaction.schemas";

import { TransactionService } from "./transaction.service";

export async function transactionRoutes(app: FastifyInstance) {
  const service = new TransactionService(app);

  /* -------------------------------------------------------------------------- */
  /*                                   CREATE                                    */
  /* -------------------------------------------------------------------------- */
  app.post("/transactions", { preHandler: [app.authenticate] }, async (req, reply) => {
    const body = createTransactionSchema.parse(req.body);
    const result = await service.create(req.user.sub, body);
    return reply.status(201).send(result);
  });

  /* -------------------------------------------------------------------------- */
  /*                                     LIST                                    */
  /* -------------------------------------------------------------------------- */
  app.get("/transactions", { preHandler: [app.authenticate] }, async (req) => {
    return await service.list(req.user.sub);
  });

  /* -------------------------------------------------------------------------- */
  /*                                   GET ONE                                  */
  /* -------------------------------------------------------------------------- */
  app.get("/transactions/:id", { preHandler: [app.authenticate] }, async (req) => {
    const { id } = transactionParamsSchema.parse(req.params);
    return await service.getOne(id, req.user.sub);
  });

  /* -------------------------------------------------------------------------- */
  /*                                    UPDATE                                   */
  /* -------------------------------------------------------------------------- */
  app.put("/transactions/:id", { preHandler: [app.authenticate] }, async (req) => {
    const { id } = transactionParamsSchema.parse(req.params);
    const body = updateTransactionSchema.parse(req.body);

    return await service.update(id, req.user.sub, body);
  });

  /* -------------------------------------------------------------------------- */
  /*                                    DELETE                                   */
  /* -------------------------------------------------------------------------- */
  app.delete("/transactions/:id", { preHandler: [app.authenticate] }, async (req) => {
    const { id } = transactionParamsSchema.parse(req.params);
    return await service.delete(id, req.user.sub);
  });
}
