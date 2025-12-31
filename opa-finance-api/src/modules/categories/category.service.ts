import { and, eq, or } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

import { CreateCategoryInput } from "./category.schemas";
import { NotFoundProblem, ForbiddenProblem, ConflictProblem } from "@/core/errors/problems";

import { categories, subcategories } from "@/db/schema";
export class CategoryService {
  constructor(private app: FastifyInstance) {}

  /* -------------------------------------------------------------------------- */
  /*                                   CREATE                                   */
  /* -------------------------------------------------------------------------- */
  async create(userId: string, data: CreateCategoryInput) {
    const existingSystem = await this.app.db
      .select()
      .from(categories)
      .where(and(eq(categories.name, data.name), eq(categories.system, true)));

    if (existingSystem.length > 0) {
      throw new ConflictProblem("Já existe uma categoria de sistema com esse nome.", "/categories");
    }

    const [category] = await this.app.db
      .insert(categories)
      .values({
        userId,
        name: data.name,
        type: data.type,
        system: false,
      })
      .returning();

    return category;
  }

  /* -------------------------------------------------------------------------- */
  /*                                   LIST                                     */
  /* -------------------------------------------------------------------------- */
  async list(userId: string) {
    return this.app.db
      .select()
      .from(categories)
      .where(
        or(
          eq(categories.userId, userId), // categorias do usuário
          eq(categories.system, true), // categorias do sistema
        ),
      );
  }

  /* -------------------------------------------------------------------------- */
  /*                                  GET ONE                                   */
  /* -------------------------------------------------------------------------- */
  async getOne(id: string, userId: string) {
    const [category] = await this.app.db.select().from(categories).where(eq(categories.id, id));

    if (!category) {
      throw new NotFoundProblem("Categoria não encontrada.", `/categories/${id}`);
    }

    // categoria de sistema é visível para todos
    if (!category.system && category.userId !== userId) {
      throw new ForbiddenProblem("Você não tem acesso a esta categoria.", `/categories/${id}`);
    }

    return category;
  }

  /* -------------------------------------------------------------------------- */
  /*                                  UPDATE                                    */
  /* -------------------------------------------------------------------------- */
  async update(id: string, userId: string, data: any) {
    const category = await this.getOne(id, userId);

    // 🚫 Categoria de sistema não pode ser alterada
    if (category.system) {
      throw new ForbiddenProblem(
        "Categorias de sistema não podem ser alteradas.",
        `/categories/${id}`,
      );
    }

    const [updated] = await this.app.db
      .update(categories)
      .set({
        name: data.name ?? category.name,
        color: data.color ?? category.color,
        updatedAt: new Date(),
      })
      .where(eq(categories.id, id))
      .returning();

    return updated;
  }

  /* -------------------------------------------------------------------------- */
  /*                                  DELETE                                    */
  /* -------------------------------------------------------------------------- */
  async delete(id: string, userId: string) {
    const category = await this.getOne(id, userId);

    // 🚫 Categoria de sistema não pode ser removida
    if (category.system) {
      throw new ForbiddenProblem(
        "Categorias de sistema não podem ser removidas.",
        `/categories/${id}`,
      );
    }

    // 🔒 Verifica subcategorias
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

    await this.app.db.delete(categories).where(eq(categories.id, id));

    return { message: "Categoria removida com sucesso." };
  }
}
