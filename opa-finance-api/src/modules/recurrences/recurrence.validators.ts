import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { ForbiddenProblem, NotFoundProblem, ValidationProblem } from "../../core/errors/problems";
import type { DB } from "../../core/plugins/drizzle";
import { DEFAULT_TIMEZONE } from "../../core/utils/timezone.utils";
import {
  accounts,
  categories,
  recurrenceOccurrences,
  recurrences,
  subcategories,
  users,
} from "../../db/schema";
import { toIsoDate } from "./recurrence.helpers";
import type { CreateRecurrenceInput, UpdateRecurrenceInput } from "./recurrence.schemas";

export class RecurrenceValidators {
  constructor(private db: DB) {}

  async getLatestMaterializedDate(
    recurrenceId: string,
    executor: DB = this.db,
  ): Promise<string | null> {
    const [row] = await executor
      .select({
        latestDate: sql<string | null>`max(${recurrenceOccurrences.occurrenceDate})::text`,
      })
      .from(recurrenceOccurrences)
      .where(
        and(
          eq(recurrenceOccurrences.recurrenceId, recurrenceId),
          eq(recurrenceOccurrences.status, "materialized"),
        ),
      );

    return row?.latestDate ?? null;
  }

  async getNowIsoDateInTimezone(timezone: string): Promise<string> {
    const result = await this.db.execute(
      sql`select to_char((now() at time zone ${timezone})::date, 'YYYY-MM-DD') as today`,
    );

    const rows = Array.isArray(result) ? result : ((result as { rows?: unknown[] }).rows ?? []);
    const firstRow = rows[0] as { today?: string } | undefined;
    const today = firstRow?.today;
    if (!today || !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
      return toIsoDate(new Date());
    }
    return today;
  }

  async getUserTimezone(userId: string): Promise<string> {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    return user?.timezone ?? DEFAULT_TIMEZONE;
  }

  async getTransferCategoryId(): Promise<string> {
    const [category] = await this.db
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(
          eq(categories.name, "Transferência"),
          eq(categories.system, true),
          isNull(categories.userId),
        ),
      )
      .limit(1);

    if (!category) {
      throw new NotFoundProblem(
        "Categoria de sistema 'Transferência' não encontrada. Execute o seed do sistema.",
        "/recurrences/materialize",
      );
    }

    return category.id;
  }

  async ensureUserOwnsAllAccounts(
    userId: string,
    accountIds: string[],
    path: string,
  ): Promise<void> {
    if (accountIds.length === 0) return;

    const ownedAccounts = await this.db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.userId, userId), inArray(accounts.id, accountIds)));

    if (ownedAccounts.length !== accountIds.length) {
      throw new ForbiddenProblem("Uma ou mais contas informadas não pertencem ao usuário.", path);
    }
  }

  async ensureAccountOwnership(userId: string, accountId: string, path: string): Promise<void> {
    const [account] = await this.db
      .select()
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);

    if (!account) {
      throw new NotFoundProblem("Conta não encontrada.", path);
    }
    if (account.userId !== userId) {
      throw new ForbiddenProblem("Acesso negado à conta.", path);
    }
  }

  async ensureCategoryOwnership(userId: string, categoryId: string, path: string): Promise<void> {
    const [category] = await this.db
      .select()
      .from(categories)
      .where(eq(categories.id, categoryId))
      .limit(1);

    if (!category) {
      throw new NotFoundProblem("Categoria não encontrada.", path);
    }
    if (category.system || category.userId !== userId) {
      throw new ForbiddenProblem("Acesso negado à categoria.", path);
    }
  }

  async ensureSubcategoryOwnership(
    userId: string,
    subcategoryId: string,
    expectedCategoryId: string | undefined,
    path: string,
  ): Promise<void> {
    const [subcategory] = await this.db
      .select()
      .from(subcategories)
      .where(eq(subcategories.id, subcategoryId))
      .limit(1);

    if (!subcategory) {
      throw new NotFoundProblem("Subcategoria não encontrada.", path);
    }
    if (subcategory.userId !== userId) {
      throw new ForbiddenProblem("Acesso negado à subcategoria.", path);
    }
    if (expectedCategoryId && subcategory.categoryId !== expectedCategoryId) {
      throw new ValidationProblem("A subcategoria não pertence à categoria informada.", path);
    }
  }

  async validatePayloadOwnership(
    userId: string,
    data: CreateRecurrenceInput | UpdateRecurrenceInput,
    baseCategoryId?: string | null,
  ): Promise<void> {
    if (data.accountId) {
      await this.ensureAccountOwnership(userId, data.accountId, "/recurrences");
    }
    if (data.fromAccountId) {
      await this.ensureAccountOwnership(userId, data.fromAccountId, "/recurrences");
    }
    if (data.toAccountId) {
      await this.ensureAccountOwnership(userId, data.toAccountId, "/recurrences");
    }
    if (data.categoryId) {
      await this.ensureCategoryOwnership(userId, data.categoryId, "/recurrences");
    }
    if (data.subcategoryId) {
      const expectedCategoryId = data.categoryId ?? baseCategoryId ?? undefined;
      await this.ensureSubcategoryOwnership(
        userId,
        data.subcategoryId,
        expectedCategoryId,
        "/recurrences",
      );
    }
  }

  async validateRecurrenceLinkedOwnership(
    userId: string,
    recurrence: Pick<
      typeof recurrences.$inferSelect,
      "originType" | "accountId" | "categoryId" | "subcategoryId" | "fromAccountId" | "toAccountId"
    >,
    path: string,
  ): Promise<void> {
    if (recurrence.originType === "transaction") {
      if (recurrence.fromAccountId || recurrence.toAccountId) {
        throw new ValidationProblem(
          "Recorrência de transação possui contas de transferência inválidas.",
          path,
        );
      }
      if (recurrence.accountId) {
        await this.ensureAccountOwnership(userId, recurrence.accountId, path);
      }
      if (recurrence.categoryId) {
        await this.ensureCategoryOwnership(userId, recurrence.categoryId, path);
      }
      if (recurrence.subcategoryId) {
        await this.ensureSubcategoryOwnership(
          userId,
          recurrence.subcategoryId,
          recurrence.categoryId ?? undefined,
          path,
        );
      }
      return;
    }

    if (recurrence.accountId || recurrence.categoryId || recurrence.subcategoryId) {
      throw new ValidationProblem(
        "Recorrência de transferência possui campos de transação inválidos.",
        path,
      );
    }
    if (!recurrence.fromAccountId || !recurrence.toAccountId) {
      throw new ValidationProblem(
        "Recorrência de transferência inválida: contas de origem e destino são obrigatórias.",
        path,
      );
    }
    if (recurrence.fromAccountId) {
      await this.ensureAccountOwnership(userId, recurrence.fromAccountId, path);
    }
    if (recurrence.toAccountId) {
      await this.ensureAccountOwnership(userId, recurrence.toAccountId, path);
    }
    if (
      recurrence.fromAccountId &&
      recurrence.toAccountId &&
      recurrence.fromAccountId === recurrence.toAccountId
    ) {
      throw new ValidationProblem("Conta de origem e destino devem ser diferentes.", path);
    }
  }
}
