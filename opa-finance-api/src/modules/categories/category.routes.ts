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

  // ---------------- CATEGORY ----------------

  app.post("/categories", { preHandler: [app.authenticate] }, async (req, reply) => {
    try {
      const body = createCategorySchema.parse(req.body);
      const result = await categoryService.create(req.user.sub, body);
      return reply.status(201).send(result);
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  });

  app.get("/categories", { preHandler: [app.authenticate] }, async (req) => {
    return categoryService.list(req.user.sub);
  });

  app.get("/categories/:id", { preHandler: [app.authenticate] }, async (req, reply) => {
    try {
      const params = categoryParamsSchema.parse(req.params);
      const result = await categoryService.getOne(params.id, req.user.sub);
      return reply.send(result);
    } catch (err: any) {
      const status = err.message.includes("não encontrada") ? 404 : 403;
      return reply.status(status).send({ message: err.message });
    }
  });

  app.put("/categories/:id", { preHandler: [app.authenticate] }, async (req, reply) => {
    try {
      // validação Zod -> erro = 400
      const params = categoryParamsSchema.parse(req.params);
      const body = updateCategorySchema.parse(req.body);

      // regra de negócio
      const result = await categoryService.update(params.id, req.user.sub, body);

      return reply.send(result);
    } catch (err: any) {
      // erros de validação Zod = 400
      if (err?.issues) {
        return reply.status(400).send({ message: err.message });
      }

      if (err.message.includes("não encontrada"))
        return reply.status(404).send({ message: err.message });

      if (err.message.includes("Acesso negado"))
        return reply.status(403).send({ message: err.message });

      return reply.status(400).send({ message: err.message });
    }
  });

  app.delete("/categories/:id", { preHandler: [app.authenticate] }, async (req, reply) => {
    try {
      const params = categoryParamsSchema.parse(req.params);

      const result = await categoryService.delete(params.id, req.user.sub);
      return reply.send(result);
    } catch (err: any) {
      let status = 400;

      if (err.message.includes("não encontrada")) {
        status = 404;
      } else if (err.message.includes("Acesso negado")) {
        status = 403;
      } else if (err.message.includes("subcategorias")) {
        status = 409;
      }

      return reply.status(status).send({ message: err.message });
    }
  });

  // ---------------- SUBCATEGORIES ----------------

  app.post("/subcategories", { preHandler: [app.authenticate] }, async (req, reply) => {
    try {
      const body = createSubcategorySchema.parse(req.body);
      const result = await subcategoryService.create(req.user.sub, body);
      return reply.status(201).send(result);
    } catch (err: any) {
      // Zod → 400
      if (err?.issues) {
        return reply.status(400).send({ message: err.message });
      }

      if (err.message.includes("não encontrada"))
        return reply.status(404).send({ message: err.message });

      if (err.message.includes("Acesso negado"))
        return reply.status(403).send({ message: err.message });

      return reply.status(400).send({ message: err.message });
    }
  });

  app.get(
    "/categories/:id/subcategories",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      try {
        const params = categoryParamsSchema.parse(req.params);
        const result = await subcategoryService.list(params.id, req.user.sub);
        return reply.send(result);
      } catch (err: any) {
        if (err?.issues) return reply.status(400).send({ message: err.message });

        if (err.message.includes("não encontrada"))
          return reply.status(404).send({ message: err.message });

        if (err.message.includes("Acesso negado"))
          return reply.status(403).send({ message: err.message });

        return reply.status(400).send({ message: err.message });
      }
    },
  );

  app.get("/subcategories/:id", { preHandler: [app.authenticate] }, async (req, reply) => {
    try {
      const params = subcategoryParamsSchema.parse(req.params);
      const result = await subcategoryService.getOne(params.id, req.user.sub);
      return reply.send(result);
    } catch (err: any) {
      if (err?.issues) return reply.status(400).send({ message: err.message });

      if (err.message.includes("não encontrada"))
        return reply.status(404).send({ message: err.message });

      if (err.message.includes("Acesso negado"))
        return reply.status(403).send({ message: err.message });

      return reply.status(400).send({ message: err.message });
    }
  });

  app.put("/subcategories/:id", { preHandler: [app.authenticate] }, async (req, reply) => {
    try {
      const params = subcategoryParamsSchema.parse(req.params);
      const body = updateSubcategorySchema.parse(req.body);
      const result = await subcategoryService.update(params.id, req.user.sub, body);
      return reply.send(result);
    } catch (err: any) {
      if (err?.issues) return reply.status(400).send({ message: err.message });

      if (err.message.includes("não encontrada"))
        return reply.status(404).send({ message: err.message });

      if (err.message.includes("Acesso negado"))
        return reply.status(403).send({ message: err.message });

      return reply.status(400).send({ message: err.message });
    }
  });

  app.delete("/subcategories/:id", { preHandler: [app.authenticate] }, async (req, reply) => {
    try {
      const params = subcategoryParamsSchema.parse(req.params);
      const result = await subcategoryService.delete(params.id, req.user.sub);
      return reply.send(result);
    } catch (err: any) {
      if (err?.issues) return reply.status(400).send({ message: err.message });

      if (err.message.includes("não encontrada"))
        return reply.status(404).send({ message: err.message });

      if (err.message.includes("Acesso negado"))
        return reply.status(403).send({ message: err.message });

      return reply.status(400).send({ message: err.message });
    }
  });
}
