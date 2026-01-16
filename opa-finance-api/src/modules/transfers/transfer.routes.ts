// src/modules/transfers/transfer.routes.ts
import { FastifyInstance } from "fastify";
import { createTransferSchema } from "./transfer.schemas";
import { TransferService } from "./transfer.service";

export async function transferRoutes(app: FastifyInstance) {
  const service = new TransferService(app);
  const transferTag = ["Transfers"];

  app.post(
    "/transfers",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: transferTag,
        summary: "Criar transferência",
        description: "Cria transferência entre contas do mesmo usuário.",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["fromAccountId", "toAccountId", "amount", "date"],
          properties: {
            fromAccountId: { type: "string", example: "uuid" },
            toAccountId: { type: "string", example: "uuid" },
            amount: { type: "number", example: 200 },
            date: { type: "string", example: "2025-01-15" },
            description: { type: "string", example: "Transferência entre contas" },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              id: { type: "string" },
              fromAccount: { type: "object" },
              toAccount: { type: "object" },
            },
            example: {
              id: "uuid",
              fromAccount: {
                id: "uuid",
                type: "expense",
                amount: 200,
              },
              toAccount: {
                id: "uuid",
                type: "income",
                amount: 200,
              },
            },
          },
        },
      },
    },
    async (req, reply) => {
      const body = createTransferSchema.parse(req.body);
      const result = await service.create(req.user.sub, body);
      return reply.status(201).send(result);
    },
  );
}
