// src/modules/transfers/transfer.routes.ts
import { FastifyInstance } from "fastify";
import { createTransferSchema } from "./transfer.schemas";
import { TransferService } from "./transfer.service";

export async function transferRoutes(app: FastifyInstance) {
  const service = new TransferService(app);

  app.post("/transfers", { preHandler: [app.authenticate] }, async (req, reply) => {
    const body = createTransferSchema.parse(req.body);
    const result = await service.create(req.user.sub, body);
    return reply.status(201).send(result);
  });
}
