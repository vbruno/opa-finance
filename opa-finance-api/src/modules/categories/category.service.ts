// src/modules/categories/category.service.ts
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

import { NotFoundProblem, ForbiddenProblem, ConflictProblem } from "@/core/errors/problems";

import { categories, subcategories } from "@/db/schema";

export class CategoryService {
  constructor(private app: FastifyInstance) {}

  /* -------------------------------------------------------------------------- */
  /*                                   CREATE                                   */
  /* -------------------------------------------------------------------------- */
  async create(userId: string, data: any) {
    const [category] = await this.app.db
      .insert(categories)
      .values({ ...data, userId })
      .returning();

    return category;
  }

  /* -------------------------------------------------------------------------- */
  /*                                   LIST                                     */
  /* -------------------------------------------------------------------------- */
  async list(userId: string) {
    return await this.app.db.select().from(categories).where(eq(categories.userId, userId));
  }

  /* -------------------------------------------------------------------------- */
  /*                                  GET ONE                                   */
  /* -------------------------------------------------------------------------- */
  async getOne(id: string, userId: string) {
    const [category] = await this.app.db.select().from(categories).where(eq(categories.id, id));

    if (!category) {
      throw new NotFoundProblem("Categoria não encontrada.", `/categories/${id}`);
    }

    if (category.userId !== userId) {
      throw new ForbiddenProblem("Você não tem acesso a esta categoria.", `/categories/${id}`);
    }

    return category;
  }

  /* -------------------------------------------------------------------------- */
  /*                                  UPDATE                                    */
  /* -------------------------------------------------------------------------- */
  async update(id: string, userId: string, data: any) {
    // Valida acesso (404 ou 403)
    await this.getOne(id, userId);

    const [updated] = await this.app.db
      .update(categories)
      .set(data)
      .where(eq(categories.id, id))
      .returning();

    return updated;
  }

  /* -------------------------------------------------------------------------- */
  /*                                  DELETE                                    */
  /* -------------------------------------------------------------------------- */
  async delete(id: string, userId: string) {
    // Valida 404 e 403
    await this.getOne(id, userId);

    // Verifica subcategorias
    const subs = await this.app.db
      .select()
      .from(subcategories)
      .where(eq(subcategories.categoryId, id));

    if (subs.length > 0) {
      throw new ConflictProblem(
        "Categoria possui subcategorias e não pode ser removida.",
        `/categories/${id}`,
      );
    }

    // Remove categoria
    await this.app.db.delete(categories).where(eq(categories.id, id));

    return { message: "Categoria removida com sucesso." };
  }
}
