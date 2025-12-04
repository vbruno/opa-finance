// src/modules/categories/subcategory.service.ts
import { eq } from "drizzle-orm";
import { FastifyInstance } from "fastify";
import { categories, subcategories } from "@/db/schema";

export class SubcategoryService {
  constructor(private app: FastifyInstance) {}

  async create(userId: string, data: any) {
    const [category] = await this.app.db
      .select()
      .from(categories)
      .where(eq(categories.id, data.categoryId));

    if (!category) throw new Error("Categoria não encontrada.");
    if (category.userId !== userId) throw new Error("Acesso negado.");

    const [sub] = await this.app.db
      .insert(subcategories)
      .values({
        ...data,
        userId,
        type: category.type, // herda tipo
      })
      .returning();

    return sub;
  }

  async list(categoryId: string, userId: string) {
    const [cat] = await this.app.db.select().from(categories).where(eq(categories.id, categoryId));

    if (!cat) throw new Error("Categoria não encontrada.");
    if (cat.userId !== userId) throw new Error("Acesso negado.");

    return this.app.db.select().from(subcategories).where(eq(subcategories.categoryId, categoryId));
  }

  async getOne(id: string, userId: string) {
    const [sub] = await this.app.db.select().from(subcategories).where(eq(subcategories.id, id));

    if (!sub) throw new Error("Subcategoria não encontrada.");
    if (sub.userId !== userId) throw new Error("Acesso negado.");

    return sub;
  }

  async update(id: string, userId: string, data: any) {
    await this.getOne(id, userId);

    const [updated] = await this.app.db
      .update(subcategories)
      .set(data)
      .where(eq(subcategories.id, id))
      .returning();

    return updated;
  }

  async delete(id: string, userId: string) {
    await this.getOne(id, userId);

    await this.app.db.delete(subcategories).where(eq(subcategories.id, id));

    return { message: "Subcategoria removida com sucesso." };
  }
}
