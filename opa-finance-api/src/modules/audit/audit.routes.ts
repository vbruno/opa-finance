import { FastifyInstance } from "fastify";

import { listAuditLogsQuerySchema } from "./audit.schemas";
import { AuditService } from "./audit.service";

export async function auditRoutes(app: FastifyInstance) {
  const service = new AuditService(app);
  const auditTag = ["Audit"];

  app.get(
    "/audit-logs",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: auditTag,
        summary: "Listar logs de auditoria",
        description: "Lista eventos de auditoria do usuário autenticado com filtros e paginação.",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            page: { type: "number", example: 1 },
            limit: { type: "number", example: 20 },
            view: { type: "string", enum: ["raw", "grouped"], example: "grouped" },
            entityType: {
              type: "string",
              enum: ["transaction", "account", "category", "subcategory"],
            },
            action: { type: "string", enum: ["create", "update", "delete"] },
            startDate: { type: "string", example: "2026-03-01" },
            endDate: { type: "string", example: "2026-03-31" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              data: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    userId: { type: "string" },
                    entityType: { type: "string" },
                    entityId: { type: "string" },
                    action: { type: "string" },
                    beforeData: { type: "object", nullable: true, additionalProperties: true },
                    afterData: { type: "object", nullable: true, additionalProperties: true },
                    metadata: { type: "object", nullable: true, additionalProperties: true },
                    summary: {
                      type: "object",
                      nullable: true,
                      additionalProperties: true,
                    },
                    beforeDataFriendly: {
                      type: "object",
                      nullable: true,
                      additionalProperties: { type: "string" },
                    },
                    afterDataFriendly: {
                      type: "object",
                      nullable: true,
                      additionalProperties: { type: "string" },
                    },
                    metadataFriendly: {
                      type: "object",
                      nullable: true,
                      additionalProperties: { type: "string" },
                    },
                    createdAt: { type: "string" },
                  },
                },
              },
              page: { type: "number" },
              limit: { type: "number" },
              total: { type: "number" },
            },
          },
        },
      },
    },
    async (req) => {
      const query = listAuditLogsQuerySchema.parse(req.query);
      return await service.list(req.user.sub, query);
    },
  );
}
