// src/modules/users/user.routes.ts
import { FastifyInstance } from "fastify";

import {
  getUserParamsSchema,
  listUsersQuerySchema,
  updateUserBodySchema,
  updateUserParamsSchema,
  deleteUserParamsSchema,
} from "./user.schemas";

import { UserService } from "./user.service";

export async function userRoutes(app: FastifyInstance) {
  const service = new UserService(app);
  const userTag = ["Users"];

  /* ---------------------------------- LIST ---------------------------------- */
  app.get(
    "/users",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: userTag,
        summary: "Listar usuários",
        description: "Lista usuários (limitado ao usuário autenticado).",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            page: { type: "number", example: 1 },
            limit: { type: "number", example: 10 },
            name: { type: "string", example: "João" },
            email: { type: "string", example: "joao@example.com" },
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
                    name: { type: "string" },
                    email: { type: "string" },
                    createdAt: { type: "string" },
                  },
                },
              },
              page: { type: "number" },
              limit: { type: "number" },
            },
          },
        },
      },
    },
    async (req) => {
      const query = listUsersQuerySchema.parse(req.query);
      return service.list(query, req.user.sub);
    },
  );

  /* ---------------------------------- GET ONE -------------------------------- */
  app.get(
    "/users/:id",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: userTag,
        summary: "Obter usuário",
        description: "Retorna dados do usuário por id.",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              email: { type: "string" },
              createdAt: { type: "string" },
            },
            example: {
              id: "uuid",
              name: "João Silva",
              email: "joao@example.com",
              createdAt: "2025-01-15T10:30:00.000Z",
            },
          },
        },
      },
    },
    async (req) => {
      const params = getUserParamsSchema.parse(req.params);
      return service.getOne(params, req.user.sub);
    },
  );

  /* ---------------------------------- UPDATE --------------------------------- */
  app.put(
    "/users/:id",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: userTag,
        summary: "Atualizar usuário",
        description: "Atualiza nome e/ou email do usuário.",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          properties: {
            name: { type: "string", example: "João Atualizado" },
            email: { type: "string", example: "novo@example.com" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              email: { type: "string" },
              createdAt: { type: "string" },
            },
          },
        },
      },
    },
    async (req) => {
      const params = updateUserParamsSchema.parse(req.params);
      const body = updateUserBodySchema.parse(req.body);
      return service.update(params, body, req.user.sub);
    },
  );

  /* ---------------------------------- DELETE --------------------------------- */
  app.delete(
    "/users/:id",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: userTag,
        summary: "Remover usuário",
        description: "Remove o usuário autenticado.",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              message: { type: "string" },
            },
            example: {
              message: "Usuário removido com sucesso.",
            },
          },
        },
      },
    },
    async (req) => {
      const params = deleteUserParamsSchema.parse(req.params);
      return service.delete(params, req.user.sub);
    },
  );
}
