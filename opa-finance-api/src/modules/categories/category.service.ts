// src/modules/categories/category.service.ts
import { eq } from "drizzle-orm";
import { FastifyInstance } from "fastify";
import { categories, subcategories } from "@/db/schema";

export class CategoryService {
  constructor(private app: FastifyInstance) {}

  async create(userId: string, data: any) {
    const [category] = await this.app.db
      .insert(categories)
      .values({ ...data, userId })
      .returning();

    return category;
  }

  async list(userId: string) {
    return await this.app.db.select().from(categories).where(eq(categories.userId, userId));
  }

  async getOne(id: string, userId: string) {
    const [category] = await this.app.db.select().from(categories).where(eq(categories.id, id));

    if (!category) throw new Error("Categoria não encontrada.");
    if (category.userId !== userId) throw new Error("Acesso negado.");

    return category;
  }

  async update(id: string, userId: string, data: any) {
    await this.getOne(id, userId);

    const [updated] = await this.app.db
      .update(categories)
      .set(data)
      .where(eq(categories.id, id))
      .returning();

    return updated;
  }

  async delete(id: string, userId: string) {
    await this.getOne(id, userId);

    const subs = await this.app.db
      .select()
      .from(subcategories)
      .where(eq(subcategories.categoryId, id));

    if (subs.length > 0) {
      throw new Error("Categoria possui subcategorias e não pode ser removida.");
    }

    await this.app.db.delete(categories).where(eq(categories.id, id));

    return { message: "Categoria removida com sucesso." };
  }
}
