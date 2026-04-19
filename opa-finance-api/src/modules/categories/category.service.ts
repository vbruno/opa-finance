import { and, eq, isNull, or, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

import { NotFoundProblem, ForbiddenProblem, ConflictProblem } from "../../core/errors/problems";

import { categories, recurrences, subcategories } from "../../db/schema";
import { AuditService } from "../audit/audit.service";
import type { CreateCategoryInput, UpdateCategoryInput } from "./category.schemas";

type SqlRowsResult<T> = {
  rows?: T[];
};

function extractSqlRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];

  if (result && typeof result === "object") {
    const rows = (result as SqlRowsResult<T>).rows;
    if (Array.isArray(rows)) return rows;
  }

  return [];
}

type DefaultCategoryTemplate = {
  name: string;
  description: string;
  type: (typeof categories.$inferInsert)["type"];
  subcategories: Array<{ name: string; description: string }>;
};

const DEFAULT_CATEGORY_TEMPLATES: DefaultCategoryTemplate[] = [
  {
    name: "Salário",
    description: "Entradas fixas mensais do trabalho principal.",
    type: "income",
    subcategories: [
      { name: "Salário CLT", description: "Recebimento mensal do emprego principal." },
      { name: "Bônus", description: "Bônus e premiações ocasionais." },
    ],
  },
  {
    name: "Renda Extra",
    description: "Entradas adicionais fora da renda principal.",
    type: "income",
    subcategories: [
      { name: "Freelance", description: "Projetos e serviços pontuais." },
      { name: "Vendas", description: "Venda de itens ou serviços." },
    ],
  },
  {
    name: "Alimentação",
    description: "Gastos com mercado e refeições.",
    type: "expense",
    subcategories: [
      { name: "Supermercado", description: "Compras de mercado para casa." },
      { name: "Restaurante", description: "Refeições fora de casa." },
    ],
  },
  {
    name: "Moradia",
    description: "Custos de residência e manutenção.",
    type: "expense",
    subcategories: [
      { name: "Aluguel", description: "Pagamento de aluguel da moradia." },
      { name: "Contas da Casa", description: "Água, luz, internet e similares." },
    ],
  },
  {
    name: "Transporte",
    description: "Despesas de deslocamento.",
    type: "expense",
    subcategories: [
      { name: "Combustível", description: "Abastecimentos do veículo." },
      { name: "Transporte Público", description: "Ônibus, metrô e recargas." },
    ],
  },
  {
    name: "Saúde",
    description: "Cuidados médicos e bem-estar.",
    type: "expense",
    subcategories: [
      { name: "Farmácia", description: "Medicamentos e itens de farmácia." },
      { name: "Consultas", description: "Consultas e exames médicos." },
    ],
  },
];

export class CategoryService {
  private audit: AuditService;

  constructor(private app: FastifyInstance) {
    this.audit = new AuditService(app);
  }

  private toAuditCategory(category: typeof categories.$inferSelect) {
    return {
      id: category.id,
      userId: category.userId,
      name: category.name,
      description: category.description,
      type: category.type,
      system: category.system,
      color: category.color,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }

  private toAuditSubcategory(subcategory: typeof subcategories.$inferSelect) {
    return {
      id: subcategory.id,
      userId: subcategory.userId,
      categoryId: subcategory.categoryId,
      name: subcategory.name,
      description: subcategory.description,
      color: subcategory.color,
      createdAt: subcategory.createdAt,
      updatedAt: subcategory.updatedAt,
    };
  }

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

    const [category] = await this.app.db.transaction(async (txDb: typeof this.app.db) => {
      const [created] = await txDb
        .insert(categories)
        .values({
          userId,
          name: data.name,
          description: data.description ?? null,
          type: data.type,
          system: false,
          color: data.color ?? null,
        })
        .returning();

      await this.audit.log(
        {
          userId,
          entityType: "category",
          entityId: created.id,
          action: "create",
          afterData: this.toAuditCategory(created),
        },
        txDb,
      );

      return [created];
    });

    return category;
  }

  async bootstrapDefaults(userId: string) {
    return this.app.db.transaction(async (txDb: typeof this.app.db) => {
      let createdCategories = 0;
      let createdSubcategories = 0;

      for (const template of DEFAULT_CATEGORY_TEMPLATES) {
        const [existingCategory] = await txDb
          .select()
          .from(categories)
          .where(
            and(
              eq(categories.userId, userId),
              eq(categories.name, template.name),
              eq(categories.type, template.type),
              eq(categories.system, false),
            ),
          )
          .limit(1);

        const category =
          existingCategory ??
          (
            await txDb
              .insert(categories)
              .values({
                userId,
                name: template.name,
                description: template.description,
                type: template.type,
                system: false,
                color: null,
              })
              .returning()
          )[0];

        if (!existingCategory) {
          createdCategories += 1;
          await this.audit.log(
            {
              userId,
              entityType: "category",
              entityId: category.id,
              action: "create",
              afterData: this.toAuditCategory(category),
            },
            txDb,
          );
        }

        for (const subTemplate of template.subcategories) {
          const [existingSubcategory] = await txDb
            .select()
            .from(subcategories)
            .where(
              and(
                eq(subcategories.userId, userId),
                eq(subcategories.categoryId, category.id),
                eq(subcategories.name, subTemplate.name),
              ),
            )
            .limit(1);

          if (existingSubcategory) {
            continue;
          }

          const [createdSubcategory] = await txDb
            .insert(subcategories)
            .values({
              userId,
              categoryId: category.id,
              name: subTemplate.name,
              description: subTemplate.description,
              color: null,
            })
            .returning();

          createdSubcategories += 1;
          await this.audit.log(
            {
              userId,
              entityType: "subcategory",
              entityId: createdSubcategory.id,
              action: "create",
              afterData: this.toAuditSubcategory(createdSubcategory),
            },
            txDb,
          );
        }
      }

      return {
        message: "Categorias básicas processadas com sucesso.",
        createdCategories,
        createdSubcategories,
      };
    });
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
  async update(id: string, userId: string, data: UpdateCategoryInput) {
    const category = await this.getOne(id, userId);

    // 🚫 Categoria de sistema não pode ser alterada
    if (category.system) {
      throw new ForbiddenProblem(
        "Categorias de sistema não podem ser alteradas.",
        `/categories/${id}`,
      );
    }

    const [updated] = await this.app.db.transaction(async (txDb: typeof this.app.db) => {
      const [updatedRow] = await txDb
        .update(categories)
        .set({
          name: data.name ?? category.name,
          description: data.description ?? category.description,
          color: data.color ?? category.color,
          updatedAt: new Date(),
        })
        .where(eq(categories.id, id))
        .returning();

      await this.audit.log(
        {
          userId,
          entityType: "category",
          entityId: updatedRow.id,
          action: "update",
          beforeData: this.toAuditCategory(category),
          afterData: this.toAuditCategory(updatedRow),
        },
        txDb,
      );

      return [updatedRow];
    });

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

    await this.app.db.transaction(async (txDb: typeof this.app.db) => {
      const lockResult = await txDb.execute(
        sql`SELECT id FROM categories WHERE id = ${id} FOR UPDATE`,
      );
      const lockRows = extractSqlRows<{ id: string }>(lockResult);
      if (lockRows.length === 0) {
        throw new NotFoundProblem("Categoria não encontrada.", `/categories/${id}`);
      }

      const [sub] = await txDb
        .select({ id: subcategories.id })
        .from(subcategories)
        .where(eq(subcategories.categoryId, id))
        .limit(1);

      if (sub) {
        throw new ConflictProblem(
          "Categoria possui subcategorias e não pode ser removida.",
          `/categories/${id}`,
        );
      }

      const [activeLinkedRecurrence] = await txDb
        .select({ id: recurrences.id })
        .from(recurrences)
        .where(
          and(
            eq(recurrences.userId, userId),
            eq(recurrences.status, "active"),
            isNull(recurrences.deletedAt),
            eq(recurrences.categoryId, id),
          ),
        )
        .limit(1);

      if (activeLinkedRecurrence) {
        throw new ConflictProblem(
          "Categoria com recorrência ativa vinculada não pode ser removida.",
          `/categories/${id}`,
        );
      }

      await txDb.delete(categories).where(eq(categories.id, id));
      await this.audit.log(
        {
          userId,
          entityType: "category",
          entityId: id,
          action: "delete",
          beforeData: this.toAuditCategory(category),
        },
        txDb,
      );
    });

    return { message: "Categoria removida com sucesso." };
  }
}
