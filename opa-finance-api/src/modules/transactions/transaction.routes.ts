// src/modules/transactions/transaction.routes.ts
import { FastifyInstance } from "fastify";

import {
  createTransactionSchema,
  updateTransactionSchema,
  transactionParamsSchema,
  listTransactionsQuerySchema,
  summaryTransactionsQuerySchema,
  topCategoriesQuerySchema,
  transactionDescriptionsQuerySchema,
} from "./transaction.schemas";

import { TransactionService } from "./transaction.service";

export async function transactionRoutes(app: FastifyInstance) {
  const service = new TransactionService(app);
  const transactionTag = ["Transactions"];

  /* CREATE */
  app.post(
    "/transactions",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: transactionTag,
        summary: "Criar transação",
        description: "Cria uma nova transação.",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["accountId", "categoryId", "type", "amount", "date"],
          properties: {
            accountId: { type: "string", example: "uuid" },
            categoryId: { type: "string", example: "uuid" },
            subcategoryId: { type: "string", nullable: true, example: "uuid" },
            type: { type: "string", example: "expense" },
            amount: { type: "number", example: 150.5 },
            date: { type: "string", example: "2025-01-15" },
            description: { type: "string", example: "Compra no supermercado" },
            notes: { type: "string", nullable: true, example: "Notas adicionais" },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
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
            },
          },
        },
      },
    },
    async (req, reply) => {
      const body = createTransactionSchema.parse(req.body);
      const result = await service.create(req.user.sub, body);
      return reply.status(201).send(result);
    },
  );

  /* LIST + FILTERS + PAGINATION */
  app.get(
    "/transactions",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: transactionTag,
        summary: "Listar transações",
        description: "Lista transações com filtros e paginação.",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            page: { type: "number", example: 1 },
            limit: { type: "number", example: 10 },
            startDate: { type: "string", example: "2025-01-01" },
            endDate: { type: "string", example: "2025-01-31" },
            accountId: { type: "string" },
            categoryId: { type: "string" },
            subcategoryId: { type: "string" },
            type: { type: "string", example: "expense" },
            sort: { type: "string", example: "date" },
            dir: { type: "string", example: "desc" },
            description: { type: "string" },
            notes: { type: "string" },
            amount: { type: "number" },
            amountOp: { type: "string", example: "gte" },
            amountMin: { type: "number" },
            amountMax: { type: "number" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              data: { type: "array", items: { type: "object" } },
              page: { type: "number" },
              limit: { type: "number" },
              total: { type: "number" },
            },
          },
        },
      },
    },
    async (req) => {
      const query = listTransactionsQuerySchema.parse(req.query);
      return await service.list(req.user.sub, query);
    },
  );

  /* GET ONE */
  app.get(
    "/transactions/:id",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: transactionTag,
        summary: "Obter transação",
        description: "Retorna transação por id.",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
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
            },
          },
        },
      },
    },
    async (req) => {
      const { id } = transactionParamsSchema.parse(req.params);
      return await service.getOne(id, req.user.sub);
    },
  );

  /* UPDATE */
  app.put(
    "/transactions/:id",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: transactionTag,
        summary: "Atualizar transação",
        description: "Atualiza uma transação.",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          properties: {
            accountId: { type: "string", example: "uuid" },
            categoryId: { type: "string", example: "uuid" },
            subcategoryId: { type: "string", nullable: true, example: "uuid" },
            type: { type: "string", example: "expense" },
            amount: { type: "number", example: 200 },
            date: { type: "string", example: "2025-01-20" },
            description: { type: "string", example: "Compra atualizada" },
            notes: { type: "string", nullable: true },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
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
            },
          },
        },
      },
    },
    async (req) => {
      const { id } = transactionParamsSchema.parse(req.params);
      const body = updateTransactionSchema.parse(req.body);
      return await service.update(id, req.user.sub, body);
    },
  );

  /* DELETE */
  app.delete(
    "/transactions/:id",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: transactionTag,
        summary: "Remover transação",
        description: "Remove uma transação.",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              message: { type: "string" },
            },
            example: {
              message: "Transação removida com sucesso.",
            },
          },
        },
      },
    },
    async (req) => {
      const { id } = transactionParamsSchema.parse(req.params);
      return await service.delete(id, req.user.sub);
    },
  );

  /* SUMMARY */
  app.get(
    "/transactions/summary",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: transactionTag,
        summary: "Resumo de transações",
        description: "Resumo de entradas, saídas e saldo.",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            startDate: { type: "string", example: "2025-01-01" },
            endDate: { type: "string", example: "2025-01-31" },
            accountId: { type: "string" },
            categoryId: { type: "string" },
            subcategoryId: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              income: { type: "number" },
              expense: { type: "number" },
              balance: { type: "number" },
            },
            example: {
              income: 5000,
              expense: 3200,
              balance: 1800,
            },
          },
        },
      },
    },
    async (req) => {
      const query = summaryTransactionsQuerySchema.parse(req.query);
      return await service.summary(req.user.sub, query);
    },
  );

  /* TOP CATEGORIES */
  app.get(
    "/transactions/top-categories",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: transactionTag,
        summary: "Top categorias",
        description: "Top 5 categorias ou subcategorias por gasto.",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            startDate: { type: "string", example: "2025-01-01" },
            endDate: { type: "string", example: "2025-01-31" },
            accountId: { type: "string" },
            type: { type: "string", example: "expense" },
            groupBy: { type: "string", example: "category" },
          },
        },
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                totalAmount: { type: "number" },
                percentage: { type: "number" },
                categoryId: { type: "string", nullable: true },
                categoryName: { type: "string", nullable: true },
              },
            },
          },
        },
      },
    },
    async (req) => {
      const query = topCategoriesQuerySchema.parse(req.query);
      return await service.topCategories(req.user.sub, query);
    },
  );

  /* TRANSACTION DESCRIPTIONS */
  app.get(
    "/transactions/descriptions",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: transactionTag,
        summary: "Descrições de transações",
        description: "Autocomplete de descrições.",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          required: ["accountId"],
          properties: {
            accountId: { type: "string", example: "uuid" },
            q: { type: "string", example: "merc" },
            limit: { type: "number", example: 5 },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              items: { type: "array", items: { type: "string" } },
            },
            example: {
              items: ["Mercado", "Mercadinho do bairro"],
            },
          },
        },
      },
    },
    async (req) => {
      const query = transactionDescriptionsQuerySchema.parse(req.query);
      return await service.descriptions(req.user.sub, query);
    },
  );
}
