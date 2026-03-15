import { FastifyInstance } from "fastify";

import { weeklyCashflowQuerySchema } from "./weekly-cashflow.schemas";
import { WeeklyCashflowService } from "./weekly-cashflow.service";

export async function weeklyCashflowRoutes(app: FastifyInstance) {
  const service = new WeeklyCashflowService(app);
  const reportsTag = ["Reports"];

  app.get(
    "/reports/weekly-cashflow",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: reportsTag,
        summary: "Fluxo semanal",
        description:
          "Retorna visão semanal com colunas fixas (total/received/spent) e catálogo de colunas dinâmicas por categoria/subcategoria.",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          required: ["year"],
          properties: {
            year: { type: "number", example: 2026 },
            weekStart: {
              type: "string",
              enum: ["monday", "sunday"],
              default: "monday",
            },
            accountIds: {
              type: "string",
              example: "uuid-account-1,uuid-account-2",
              description: "Lista de ids de conta separados por vírgula (opcional).",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              year: { type: "number" },
              weekStart: { type: "string" },
              appliedAccountIds: {
                type: "array",
                items: { type: "string" },
              },
              defaultAccountId: { type: ["string", "null"] },
              summaryColumns: {
                type: "array",
                items: { type: "string" },
              },
              columnsCatalog: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    label: { type: "string" },
                    type: { type: "string" },
                    scope: { type: "string" },
                    categoryId: { type: "string" },
                    categoryName: { type: "string" },
                    subcategoryId: { type: ["string", "null"] },
                    subcategoryName: { type: ["string", "null"] },
                  },
                },
              },
              weeks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    week: { type: "number" },
                    startDate: { type: "string" },
                    endDate: { type: "string" },
                    total: { type: "number" },
                    received: { type: "number" },
                    spent: { type: "number" },
                    dynamicValues: {
                      type: "object",
                      additionalProperties: { type: "number" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (req) => {
      const query = weeklyCashflowQuerySchema.parse(req.query);
      return await service.get(req.user.sub, query);
    },
  );
}
