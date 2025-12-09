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

  /* -------------------------------------------------------------------------- */
  /*                                   CREATE                                   */
  /* -------------------------------------------------------------------------- */
  app.post("/categories", { preHandler: [app.authenticate] }, async (req, reply) => {
    const body = createCategorySchema.parse(req.body);
    const category = await categoryService.create(req.user.sub, body);
    return reply.status(201).send(category);
  });

  /* -------------------------------------------------------------------------- */
  /*                                    LIST                                    */
  /* -------------------------------------------------------------------------- */
  app.get("/categories", { preHandler: [app.authenticate] }, async (req) => {
    return categoryService.list(req.user.sub);
  });

  /* -------------------------------------------------------------------------- */
  /*                                  GET ONE                                   */
  /* -------------------------------------------------------------------------- */
  app.get("/categories/:id", { preHandler: [app.authenticate] }, async (req) => {
    const { id } = categoryParamsSchema.parse(req.params);
    return await categoryService.getOne(id, req.user.sub);
  });

  /* -------------------------------------------------------------------------- */
  /*                                  UPDATE                                    */
  /* -------------------------------------------------------------------------- */
  app.put("/categories/:id", { preHandler: [app.authenticate] }, async (req) => {
    const { id } = categoryParamsSchema.parse(req.params);
    const body = updateCategorySchema.parse(req.body);

    return await categoryService.update(id, req.user.sub, body);
  });

  /* -------------------------------------------------------------------------- */
  /*                                  DELETE                                    */
  /* -------------------------------------------------------------------------- */
  app.delete("/categories/:id", { preHandler: [app.authenticate] }, async (req) => {
    const { id } = categoryParamsSchema.parse(req.params);
    return await categoryService.delete(id, req.user.sub);
  });

  /* -------------------------------------------------------------------------- */
  /*                               SUBCATEGORIES                                */
  /* -------------------------------------------------------------------------- */

  app.post("/subcategories", { preHandler: [app.authenticate] }, async (req, reply) => {
    const body = createSubcategorySchema.parse(req.body);
    const sub = await subcategoryService.create(req.user.sub, body);
    return reply.status(201).send(sub);
  });

  app.get("/categories/:id/subcategories", { preHandler: [app.authenticate] }, async (req) => {
    const { id } = categoryParamsSchema.parse(req.params);
    return await subcategoryService.list(id, req.user.sub);
  });

  app.get("/subcategories/:id", { preHandler: [app.authenticate] }, async (req) => {
    const { id } = subcategoryParamsSchema.parse(req.params);
    return await subcategoryService.getOne(id, req.user.sub);
  });

  app.put("/subcategories/:id", { preHandler: [app.authenticate] }, async (req) => {
    const { id } = subcategoryParamsSchema.parse(req.params);
    const body = updateSubcategorySchema.parse(req.body);

    return await subcategoryService.update(id, req.user.sub, body);
  });

  app.delete("/subcategories/:id", { preHandler: [app.authenticate] }, async (req) => {
    const { id } = subcategoryParamsSchema.parse(req.params);
    return await subcategoryService.delete(id, req.user.sub);
  });
}
