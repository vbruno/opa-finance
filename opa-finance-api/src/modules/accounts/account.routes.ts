// src/modules/accounts/account.routes.ts
import { FastifyInstance } from "fastify";
import { createAccountSchema, updateAccountSchema, accountParamsSchema } from "./account.schemas";
import { AccountService } from "./account.service";

export async function accountRoutes(app: FastifyInstance) {
  const service = new AccountService(app);
  const accountTag = ["Accounts"];

  /* -------------------------------------------------------------------------- */
  /*                                   CREATE                                   */
  /* -------------------------------------------------------------------------- */
  app.post(
    "/accounts",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: accountTag,
        summary: "Criar conta",
        description: "Cria uma conta para o usuário autenticado.",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["name", "type"],
          properties: {
            name: { type: "string", example: "Carteira" },
            type: { type: "string", example: "cash" },
            color: { type: "string", nullable: true, example: "#00AEEF" },
            icon: { type: "string", nullable: true, example: "wallet" },
            isPrimary: { type: "boolean", example: false },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              id: { type: "string" },
              userId: { type: "string" },
              name: { type: "string" },
              type: { type: "string" },
              color: { type: "string", nullable: true },
              icon: { type: "string", nullable: true },
              isPrimary: { type: "boolean" },
              currentBalance: { type: "number" },
              createdAt: { type: "string" },
              updatedAt: { type: "string" },
            },
            example: {
              id: "uuid",
              userId: "uuid",
              name: "Carteira",
              type: "cash",
              color: "#00AEEF",
              icon: "wallet",
              isPrimary: true,
              currentBalance: 0,
              createdAt: "2025-01-15T10:30:00.000Z",
              updatedAt: "2025-01-15T10:30:00.000Z",
            },
          },
        },
      },
    },
    async (req, reply) => {
      const body = createAccountSchema.parse(req.body);
      const account = await service.create(req.user.sub, body);
      return reply.status(201).send(account);
    },
  );

  /* -------------------------------------------------------------------------- */
  /*                                    LIST                                    */
  /* -------------------------------------------------------------------------- */
  app.get(
    "/accounts",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: accountTag,
        summary: "Listar contas",
        description: "Lista contas do usuário autenticado.",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                userId: { type: "string" },
                name: { type: "string" },
                type: { type: "string" },
                color: { type: "string", nullable: true },
                icon: { type: "string", nullable: true },
                isPrimary: { type: "boolean" },
                currentBalance: { type: "number" },
                createdAt: { type: "string" },
                updatedAt: { type: "string" },
              },
            },
          },
        },
      },
    },
    async (req) => {
      return await service.list(req.user.sub);
    },
  );

  /* -------------------------------------------------------------------------- */
  /*                                   GET ONE                                  */
  /* -------------------------------------------------------------------------- */
  app.get(
    "/accounts/:id",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: accountTag,
        summary: "Obter conta",
        description: "Retorna uma conta específica.",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              userId: { type: "string" },
              name: { type: "string" },
              type: { type: "string" },
              color: { type: "string", nullable: true },
              icon: { type: "string", nullable: true },
              isPrimary: { type: "boolean" },
              currentBalance: { type: "number" },
              createdAt: { type: "string" },
              updatedAt: { type: "string" },
            },
          },
        },
      },
    },
    async (req) => {
      const { id } = accountParamsSchema.parse(req.params);
      return await service.getOne(id, req.user.sub);
    },
  );

  /* -------------------------------------------------------------------------- */
  /*                                   UPDATE                                   */
  /* -------------------------------------------------------------------------- */
  app.put(
    "/accounts/:id",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: accountTag,
        summary: "Atualizar conta",
        description: "Atualiza campos da conta.",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          properties: {
            name: { type: "string", example: "Conta Alterada" },
            type: { type: "string", example: "checking_account" },
            color: { type: "string", nullable: true, example: "#00AEEF" },
            icon: { type: "string", nullable: true, example: "wallet" },
            isPrimary: { type: "boolean", example: true },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              userId: { type: "string" },
              name: { type: "string" },
              type: { type: "string" },
              color: { type: "string", nullable: true },
              icon: { type: "string", nullable: true },
              isPrimary: { type: "boolean" },
              currentBalance: { type: "number" },
              createdAt: { type: "string" },
              updatedAt: { type: "string" },
            },
          },
        },
      },
    },
    async (req) => {
      const { id } = accountParamsSchema.parse(req.params);
      const body = updateAccountSchema.parse(req.body);
      return await service.update(id, req.user.sub, body);
    },
  );

  /* -------------------------------------------------------------------------- */
  /*                                SET PRIMARY                                 */
  /* -------------------------------------------------------------------------- */
  app.put(
    "/accounts/:id/primary",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: accountTag,
        summary: "Definir conta principal",
        description: "Define a conta como principal.",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              userId: { type: "string" },
              name: { type: "string" },
              type: { type: "string" },
              color: { type: "string", nullable: true },
              icon: { type: "string", nullable: true },
              isPrimary: { type: "boolean" },
              currentBalance: { type: "number" },
              createdAt: { type: "string" },
              updatedAt: { type: "string" },
            },
          },
        },
      },
    },
    async (req) => {
      const { id } = accountParamsSchema.parse(req.params);
      return await service.setPrimary(id, req.user.sub);
    },
  );

  /* -------------------------------------------------------------------------- */
  /*                                   DELETE                                   */
  /* -------------------------------------------------------------------------- */
  app.delete(
    "/accounts/:id",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: accountTag,
        summary: "Remover conta",
        description: "Remove uma conta do usuário.",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              message: { type: "string" },
            },
            example: {
              message: "Conta removida com sucesso.",
            },
          },
        },
      },
    },
    async (req) => {
      const { id } = accountParamsSchema.parse(req.params);
      return await service.delete(id, req.user.sub);
    },
  );
}
