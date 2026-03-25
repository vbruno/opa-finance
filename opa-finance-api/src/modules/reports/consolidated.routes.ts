import { FastifyInstance } from "fastify";

import { consolidatedQuerySchema, consolidatedYearsQuerySchema } from "./consolidated.schemas";
import { ConsolidatedService } from "./consolidated.service";

export async function consolidatedRoutes(app: FastifyInstance) {
  const service = new ConsolidatedService(app);
  const reportsTag = ["Reports"];

  app.get(
    "/reports/consolidated/years",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: reportsTag,
        summary: "Anos com movimentação para balanço",
        description:
          "Retorna os anos que possuem transações para o usuário, com filtro opcional por contas.",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
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
              years: {
                type: "array",
                items: { type: "number" },
              },
            },
          },
        },
      },
    },
    async (req) => {
      const query = consolidatedYearsQuerySchema.parse(req.query);
      return await service.listYears(req.user.sub, query);
    },
  );

  app.get(
    "/reports/consolidated",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: reportsTag,
        summary: "Balanço anual",
        description:
          "Retorna balanço anual agrupado por tipo > categoria > subcategoria, com totais mensais e anuais.",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          required: ["year"],
          properties: {
            year: { type: "number", example: 2026 },
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
              accountIds: {
                type: "array",
                items: { type: "string" },
              },
              income: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    categoryId: { type: "string" },
                    categoryName: { type: "string" },
                    months: {
                      type: "array",
                      items: { type: "number" },
                      minItems: 12,
                      maxItems: 12,
                    },
                    yearTotal: { type: "number" },
                    subcategories: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          subcategoryId: { type: "string" },
                          subcategoryName: { type: "string" },
                          months: {
                            type: "array",
                            items: { type: "number" },
                            minItems: 12,
                            maxItems: 12,
                          },
                          yearTotal: { type: "number" },
                        },
                      },
                    },
                  },
                },
              },
              expense: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    categoryId: { type: "string" },
                    categoryName: { type: "string" },
                    months: {
                      type: "array",
                      items: { type: "number" },
                      minItems: 12,
                      maxItems: 12,
                    },
                    yearTotal: { type: "number" },
                    subcategories: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          subcategoryId: { type: "string" },
                          subcategoryName: { type: "string" },
                          months: {
                            type: "array",
                            items: { type: "number" },
                            minItems: 12,
                            maxItems: 12,
                          },
                          yearTotal: { type: "number" },
                        },
                      },
                    },
                  },
                },
              },
              totals: {
                type: "object",
                properties: {
                  income: {
                    type: "object",
                    properties: {
                      months: {
                        type: "array",
                        items: { type: "number" },
                        minItems: 12,
                        maxItems: 12,
                      },
                      yearTotal: { type: "number" },
                    },
                  },
                  expense: {
                    type: "object",
                    properties: {
                      months: {
                        type: "array",
                        items: { type: "number" },
                        minItems: 12,
                        maxItems: 12,
                      },
                      yearTotal: { type: "number" },
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
      const query = consolidatedQuerySchema.parse(req.query);
      return await service.get(req.user.sub, query);
    },
  );
}
