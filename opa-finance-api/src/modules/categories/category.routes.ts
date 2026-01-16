// src/modules/categories/category.routes.ts
import { FastifyInstance } from "fastify";

import {
  createCategorySchema,
  updateCategorySchema,
  categoryParamsSchema,
} from "./category.schemas";

import { CategoryService } from "./category.service";
import {
  createSubcategorySchema,
  updateSubcategorySchema,
  subcategoryParamsSchema,
} from "./subcategory.schemas";

import { SubcategoryService } from "./subcategory.service";

export async function categoryRoutes(app: FastifyInstance) {
  const categoryService = new CategoryService(app);
  const subcategoryService = new SubcategoryService(app);
  const categoryTag = ["Categories"];
  const subcategoryTag = ["Subcategories"];

  /* -------------------------------------------------------------------------- */
  /*                                   CREATE                                   */
  /* -------------------------------------------------------------------------- */
  app.post(
    "/categories",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: categoryTag,
        summary: "Criar categoria",
        description: "Cria categoria do usuário.",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["name", "type"],
          properties: {
            name: { type: "string", example: "Alimentação" },
            type: { type: "string", example: "expense" },
            color: { type: "string", nullable: true, example: "#FF9900" },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              id: { type: "string" },
              userId: { type: "string", nullable: true },
              name: { type: "string" },
              type: { type: "string" },
              system: { type: "boolean" },
              color: { type: "string", nullable: true },
              createdAt: { type: "string" },
              updatedAt: { type: "string" },
            },
          },
        },
      },
    },
    async (req, reply) => {
      const body = createCategorySchema.parse(req.body);
      const category = await categoryService.create(req.user.sub, body);
      return reply.status(201).send(category);
    },
  );

  /* -------------------------------------------------------------------------- */
  /*                                    LIST                                    */
  /* -------------------------------------------------------------------------- */
  app.get(
    "/categories",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: categoryTag,
        summary: "Listar categorias",
        description: "Lista categorias do usuário e categorias de sistema.",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                userId: { type: "string", nullable: true },
                name: { type: "string" },
                type: { type: "string" },
                system: { type: "boolean" },
                color: { type: "string", nullable: true },
                createdAt: { type: "string" },
                updatedAt: { type: "string" },
              },
            },
          },
        },
      },
    },
    async (req) => {
      return categoryService.list(req.user.sub);
    },
  );

  /* -------------------------------------------------------------------------- */
  /*                                  GET ONE                                   */
  /* -------------------------------------------------------------------------- */
  app.get(
    "/categories/:id",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: categoryTag,
        summary: "Obter categoria",
        description: "Retorna categoria por id.",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              userId: { type: "string", nullable: true },
              name: { type: "string" },
              type: { type: "string" },
              system: { type: "boolean" },
              color: { type: "string", nullable: true },
              createdAt: { type: "string" },
              updatedAt: { type: "string" },
            },
          },
        },
      },
    },
    async (req) => {
      const { id } = categoryParamsSchema.parse(req.params);
      return await categoryService.getOne(id, req.user.sub);
    },
  );

  /* -------------------------------------------------------------------------- */
  /*                                  UPDATE                                    */
  /* -------------------------------------------------------------------------- */
  app.put(
    "/categories/:id",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: categoryTag,
        summary: "Atualizar categoria",
        description: "Atualiza categoria do usuário.",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          properties: {
            name: { type: "string", example: "Alimentação e bebidas" },
            color: { type: "string", nullable: true, example: "#FF9900" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              userId: { type: "string", nullable: true },
              name: { type: "string" },
              type: { type: "string" },
              system: { type: "boolean" },
              color: { type: "string", nullable: true },
              createdAt: { type: "string" },
              updatedAt: { type: "string" },
            },
          },
        },
      },
    },
    async (req) => {
      const { id } = categoryParamsSchema.parse(req.params);
      const body = updateCategorySchema.parse(req.body);

      return await categoryService.update(id, req.user.sub, body);
    },
  );

  /* -------------------------------------------------------------------------- */
  /*                                  DELETE                                    */
  /* -------------------------------------------------------------------------- */
  app.delete(
    "/categories/:id",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: categoryTag,
        summary: "Remover categoria",
        description: "Remove categoria do usuário.",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              message: { type: "string" },
            },
            example: {
              message: "Categoria removida com sucesso.",
            },
          },
        },
      },
    },
    async (req) => {
      const { id } = categoryParamsSchema.parse(req.params);
      return await categoryService.delete(id, req.user.sub);
    },
  );

  /* -------------------------------------------------------------------------- */
  /*                               SUBCATEGORIES                                */
  /* -------------------------------------------------------------------------- */

  app.post(
    "/subcategories",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: subcategoryTag,
        summary: "Criar subcategoria",
        description: "Cria subcategoria vinculada a uma categoria.",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["categoryId", "name"],
          properties: {
            categoryId: { type: "string", example: "uuid" },
            name: { type: "string", example: "Restaurantes" },
            color: { type: "string", nullable: true, example: "#FF9900" },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              id: { type: "string" },
              userId: { type: "string" },
              categoryId: { type: "string" },
              name: { type: "string" },
              color: { type: "string", nullable: true },
              createdAt: { type: "string" },
              updatedAt: { type: "string" },
            },
          },
        },
      },
    },
    async (req, reply) => {
      const body = createSubcategorySchema.parse(req.body);
      const sub = await subcategoryService.create(req.user.sub, body);
      return reply.status(201).send(sub);
    },
  );

  app.get(
    "/categories/:id/subcategories",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: subcategoryTag,
        summary: "Listar subcategorias",
        description: "Lista subcategorias de uma categoria.",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                userId: { type: "string" },
                categoryId: { type: "string" },
                name: { type: "string" },
                color: { type: "string", nullable: true },
                createdAt: { type: "string" },
                updatedAt: { type: "string" },
              },
            },
          },
        },
      },
    },
    async (req) => {
      const { id } = categoryParamsSchema.parse(req.params);
      return await subcategoryService.list(id, req.user.sub);
    },
  );

  app.get(
    "/subcategories/:id",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: subcategoryTag,
        summary: "Obter subcategoria",
        description: "Retorna subcategoria por id.",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              userId: { type: "string" },
              categoryId: { type: "string" },
              name: { type: "string" },
              color: { type: "string", nullable: true },
              createdAt: { type: "string" },
              updatedAt: { type: "string" },
            },
          },
        },
      },
    },
    async (req) => {
      const { id } = subcategoryParamsSchema.parse(req.params);
      return await subcategoryService.getOne(id, req.user.sub);
    },
  );

  app.put(
    "/subcategories/:id",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: subcategoryTag,
        summary: "Atualizar subcategoria",
        description: "Atualiza subcategoria.",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          properties: {
            name: { type: "string", example: "Restaurantes" },
            color: { type: "string", nullable: true, example: "#FF9900" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              userId: { type: "string" },
              categoryId: { type: "string" },
              name: { type: "string" },
              color: { type: "string", nullable: true },
              createdAt: { type: "string" },
              updatedAt: { type: "string" },
            },
          },
        },
      },
    },
    async (req) => {
      const { id } = subcategoryParamsSchema.parse(req.params);
      const body = updateSubcategorySchema.parse(req.body);

      return await subcategoryService.update(id, req.user.sub, body);
    },
  );

  app.delete(
    "/subcategories/:id",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: subcategoryTag,
        summary: "Remover subcategoria",
        description: "Remove subcategoria.",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              message: { type: "string" },
            },
            example: {
              message: "Subcategoria removida com sucesso.",
            },
          },
        },
      },
    },
    async (req) => {
      const { id } = subcategoryParamsSchema.parse(req.params);
      return await subcategoryService.delete(id, req.user.sub);
    },
  );
}
