import { eq } from "drizzle-orm";
import { FastifyInstance } from "fastify";
import { NotFoundProblem, ForbiddenProblem, ValidationProblem } from "../../core/errors/problems";
import { categories, subcategories } from "../../db/schema";
import { AuditService } from "../audit/audit.service";

export class SubcategoryService {
  private audit: AuditService;

  constructor(private app: FastifyInstance) {
    this.audit = new AuditService(app);
  }

  private toAuditSubcategory(subcategory: typeof subcategories.$inferSelect) {
    return {
      id: subcategory.id,
      userId: subcategory.userId,
      categoryId: subcategory.categoryId,
      name: subcategory.name,
      color: subcategory.color,
      createdAt: subcategory.createdAt,
      updatedAt: subcategory.updatedAt,
    };
  }

  /* -------------------------------------------------------------------------- */
  /*                                   CREATE                                    */
  /* -------------------------------------------------------------------------- */
  async create(userId: string, data: any) {
    const [category] = await this.app.db
      .select()
      .from(categories)
      .where(eq(categories.id, data.categoryId));

    if (!category) {
      throw new NotFoundProblem("Categoria não encontrada.", "/categories");
    }

    // 🚫 Categoria de sistema não pode ter subcategoria
    if (category.system) {
      throw new ValidationProblem(
        "Categorias do sistema não permitem subcategorias.",
        "/subcategories",
      );
    }

    // 🔒 Categoria precisa pertencer ao usuário
    if (category.userId !== userId) {
      throw new ForbiddenProblem("Acesso negado à categoria.", "/categories");
    }

    const inheritedColor = data.color ?? category.color ?? null;

    const [sub] = await this.app.db.transaction(async (txDb: typeof this.app.db) => {
      const [created] = await txDb
        .insert(subcategories)
        .values({
          userId,
          categoryId: data.categoryId,
          name: data.name,
          color: inheritedColor,
        })
        .returning();

      await this.audit.log(
        {
          userId,
          entityType: "subcategory",
          entityId: created.id,
          action: "create",
          afterData: this.toAuditSubcategory(created),
        },
        txDb,
      );

      return [created];
    });

    return sub;
  }

  /* -------------------------------------------------------------------------- */
  /*                                     LIST                                    */
  /* -------------------------------------------------------------------------- */
  async list(categoryId: string, userId: string) {
    const [category] = await this.app.db
      .select()
      .from(categories)
      .where(eq(categories.id, categoryId));

    if (!category) {
      throw new NotFoundProblem("Categoria não encontrada.", "/categories");
    }

    // 🚫 Categoria de sistema não possui subcategorias
    if (category.system) {
      return [];
    }

    if (category.userId !== userId) {
      throw new ForbiddenProblem("Acesso negado à categoria.", "/categories");
    }

    return this.app.db.select().from(subcategories).where(eq(subcategories.categoryId, categoryId));
  }

  /* -------------------------------------------------------------------------- */
  /*                                    GET ONE                                  */
  /* -------------------------------------------------------------------------- */
  async getOne(id: string, userId: string) {
    const [sub] = await this.app.db.select().from(subcategories).where(eq(subcategories.id, id));

    if (!sub) {
      throw new NotFoundProblem("Subcategoria não encontrada.", "/subcategories");
    }

    if (sub.userId !== userId) {
      throw new ForbiddenProblem("Acesso negado à subcategoria.", "/subcategories");
    }

    return sub;
  }

  /* -------------------------------------------------------------------------- */
  /*                                   UPDATE                                    */
  /* -------------------------------------------------------------------------- */
  async update(id: string, userId: string, data: any) {
    const existingSub = await this.getOne(id, userId);

    const [updated] = await this.app.db.transaction(async (txDb: typeof this.app.db) => {
      const [updatedRow] = await txDb
        .update(subcategories)
        .set({
          name: data.name ?? existingSub.name,
          color: data.color !== undefined ? data.color : existingSub.color,
          updatedAt: new Date(),
        })
        .where(eq(subcategories.id, id))
        .returning();

      await this.audit.log(
        {
          userId,
          entityType: "subcategory",
          entityId: updatedRow.id,
          action: "update",
          beforeData: this.toAuditSubcategory(existingSub),
          afterData: this.toAuditSubcategory(updatedRow),
        },
        txDb,
      );

      return [updatedRow];
    });

    return updated;
  }

  /* -------------------------------------------------------------------------- */
  /*                                   DELETE                                    */
  /* -------------------------------------------------------------------------- */
  async delete(id: string, userId: string) {
    const existing = await this.getOne(id, userId);

    await this.app.db.transaction(async (txDb: typeof this.app.db) => {
      await txDb.delete(subcategories).where(eq(subcategories.id, id));
      await this.audit.log(
        {
          userId,
          entityType: "subcategory",
          entityId: id,
          action: "delete",
          beforeData: this.toAuditSubcategory(existing),
        },
        txDb,
      );
    });

    return { message: "Subcategoria removida com sucesso." };
  }
}
