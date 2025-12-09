// src/modules/categories/subcategory.service.ts
import { eq } from "drizzle-orm";
import { FastifyInstance } from "fastify";
import { categories, subcategories } from "@/db/schema";

export class SubcategoryService {
  constructor(private app: FastifyInstance) {}

  /* -------------------------------------------------------------------------- */
  /*                                   CREATE                                    */
  /* -------------------------------------------------------------------------- */
  async create(userId: string, data: any) {
    // Buscar categoria
    const [category] = await this.app.db
      .select()
      .from(categories)
      .where(eq(categories.id, data.categoryId));

    if (!category) throw new Error("Categoria não encontrada.");
    if (category.userId !== userId) throw new Error("Acesso negado.");

    // Herança da cor da categoria
    const inheritedColor = data.color ?? category.color ?? null;

    const [sub] = await this.app.db
      .insert(subcategories)
      .values({
        categoryId: data.categoryId,
        name: data.name,
        color: inheritedColor,
        userId,
      })
      .returning();

    return sub;
  }

  /* -------------------------------------------------------------------------- */
  /*                                     LIST                                    */
  /* -------------------------------------------------------------------------- */
  async list(categoryId: string, userId: string) {
    const [cat] = await this.app.db.select().from(categories).where(eq(categories.id, categoryId));

    if (!cat) throw new Error("Categoria não encontrada.");
    if (cat.userId !== userId) throw new Error("Acesso negado.");

    return this.app.db.select().from(subcategories).where(eq(subcategories.categoryId, categoryId));
  }

  /* -------------------------------------------------------------------------- */
  /*                                    GET ONE                                  */
  /* -------------------------------------------------------------------------- */
  async getOne(id: string, userId: string) {
    const [sub] = await this.app.db.select().from(subcategories).where(eq(subcategories.id, id));

    if (!sub) throw new Error("Subcategoria não encontrada.");
    if (sub.userId !== userId) throw new Error("Acesso negado.");

    return sub;
  }

  /* -------------------------------------------------------------------------- */
  /*                                   UPDATE                                    */
  /* -------------------------------------------------------------------------- */
  async update(id: string, userId: string, data: any) {
    const existingSub = await this.getOne(id, userId);

    let newColor = existingSub.color;

    // Caso envie nova cor → usa
    if (data.color !== undefined) {
      newColor = data.color;
    }

    const [updated] = await this.app.db
      .update(subcategories)
      .set({
        name: data.name ?? existingSub.name,
        color: newColor,
        updatedAt: new Date(),
      })
      .where(eq(subcategories.id, id))
      .returning();

    return updated;
  }

  /* -------------------------------------------------------------------------- */
  /*                                   DELETE                                    */
  /* -------------------------------------------------------------------------- */
  async delete(id: string, userId: string) {
    await this.getOne(id, userId);

    await this.app.db.delete(subcategories).where(eq(subcategories.id, id));

    return { message: "Subcategoria removida com sucesso." };
  }
}
