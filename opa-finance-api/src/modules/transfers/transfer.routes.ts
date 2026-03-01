// src/modules/transfers/transfer.routes.ts
import { FastifyInstance } from "fastify";
import { createTransferSchema } from "./transfer.schemas";
import { TransferService } from "./transfer.service";

export async function transferRoutes(app: FastifyInstance) {
  const service = new TransferService(app);
  const transferTag = ["Transfers"];
  const transferTransactionProperties = {
    id: { type: "string" },
    userId: { type: "string" },
    accountId: { type: "string" },
    categoryId: { type: "string" },
    subcategoryId: { type: "string", nullable: true },
    type: { type: "string" },
    amount: { type: "number" },
    date: { type: "string" },
    description: { type: "string", nullable: true },
    notes: { type: "string", nullable: true },
    transferId: { type: "string", nullable: true },
    createdAt: { type: "string" },
    updatedAt: { type: "string", nullable: true },
  };

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
              fromAccount: {
                type: "object",
                properties: transferTransactionProperties,
              },
              toAccount: {
                type: "object",
                properties: transferTransactionProperties,
              },
            },
            example: {
              id: "uuid",
              fromAccount: {
                id: "uuid",
                accountId: "uuid",
                type: "expense",
                amount: 200,
              },
              toAccount: {
                id: "uuid",
                accountId: "uuid",
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
