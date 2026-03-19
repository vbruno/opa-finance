import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

import { ForbiddenProblem } from "../../core/errors/problems";
import { accounts, categories, subcategories, transactions } from "../../db/schema";
import type {
  TrialBalanceCategory,
  TrialBalanceQuery,
  TrialBalanceResponse,
  TrialBalanceYearsQuery,
  TrialBalanceYearsResponse,
} from "./consolidated.schemas";

type TrialBalanceType = "income" | "expense";
const NO_SUBCATEGORY_LABEL = "Sem subcategoria";

type AggregatedRow = {
  type: TrialBalanceType;
  categoryId: string;
  categoryName: string;
  subcategoryId: string | null;
  subcategoryName: string | null;
  month: number;
  total: string;
};

export class TrialBalanceService {
  constructor(private app: FastifyInstance) {}

  private emptyMonths() {
    return Array.from({ length: 12 }, () => 0);
  }

  private sumYear(months: number[]) {
    return months.reduce((acc, value) => acc + value, 0);
  }

  private resolveSubcategoryRow(row: AggregatedRow) {
    if (row.subcategoryId && row.subcategoryName) {
      return {
        subcategoryId: row.subcategoryId,
        subcategoryName: row.subcategoryName,
      };
    }

    return {
      // Synthetic id keeps row key stable while preserving response shape.
      subcategoryId: `${row.categoryId}::no-subcategory`,
      subcategoryName: NO_SUBCATEGORY_LABEL,
    };
  }

  private ensureUserOwnsAllAccounts(
    inputAccountIds: string[],
    ownedAccounts: Array<{ id: string }>,
    errorInstance: string,
  ) {
    if (inputAccountIds.length === 0) {
      return;
    }

    const ownedSet = new Set(ownedAccounts.map((account) => account.id));
    const hasForeignAccount = inputAccountIds.some((accountId) => !ownedSet.has(accountId));
    if (hasForeignAccount) {
      throw new ForbiddenProblem(
        "Uma ou mais contas informadas não pertencem ao usuário.",
        errorInstance,
      );
    }
  }

  async listYears(
    userId: string,
    query: TrialBalanceYearsQuery,
  ): Promise<TrialBalanceYearsResponse> {
    const requestedAccountIds = query.accountIds ?? [];

    const ownedAccounts = await this.app.db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.userId, userId));

    this.ensureUserOwnsAllAccounts(
      requestedAccountIds,
      ownedAccounts,
      "/reports/consolidated/years",
    );

    const filters = [eq(transactions.userId, userId)];
    if (requestedAccountIds.length > 0) {
      filters.push(inArray(transactions.accountId, requestedAccountIds));
    }

    const rows = await this.app.db
      .select({
        year: sql<number>`extract(year from ${transactions.date}::date)::int`,
      })
      .from(transactions)
      .where(and(...filters))
      .groupBy(sql`extract(year from ${transactions.date}::date)`)
      .orderBy(sql`extract(year from ${transactions.date}::date) desc`);

    const typedRows = rows as Array<{ year: number }>;
    return {
      years: typedRows.map((row) => Number(row.year)).filter((rowYear) => Number.isFinite(rowYear)),
    };
  }

  async get(userId: string, query: TrialBalanceQuery): Promise<TrialBalanceResponse> {
    const year = query.year;
    const requestedAccountIds = query.accountIds ?? [];
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const ownedAccounts = await this.app.db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.userId, userId));

    this.ensureUserOwnsAllAccounts(requestedAccountIds, ownedAccounts, "/reports/consolidated");

    const filters = [
      eq(transactions.userId, userId),
      gte(transactions.date, startDate),
      lte(transactions.date, endDate),
    ];

    if (requestedAccountIds.length > 0) {
      filters.push(inArray(transactions.accountId, requestedAccountIds));
    }

    const rows = await this.app.db
      .select({
        type: transactions.type,
        categoryId: categories.id,
        categoryName: categories.name,
        subcategoryId: transactions.subcategoryId,
        subcategoryName: subcategories.name,
        month: sql<number>`extract(month from ${transactions.date}::date)::int`,
        total: sql<string>`sum(${transactions.amount})::text`,
      })
      .from(transactions)
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
      .leftJoin(subcategories, eq(transactions.subcategoryId, subcategories.id))
      .where(and(...filters))
      .groupBy(
        transactions.type,
        categories.id,
        categories.name,
        transactions.subcategoryId,
        subcategories.name,
        sql`extract(month from ${transactions.date}::date)`,
      );

    const typedRows = rows as AggregatedRow[];

    const byType: Record<TrialBalanceType, Map<string, TrialBalanceCategory>> = {
      income: new Map<string, TrialBalanceCategory>(),
      expense: new Map<string, TrialBalanceCategory>(),
    };

    const totals = {
      income: {
        months: this.emptyMonths(),
        yearTotal: 0,
      },
      expense: {
        months: this.emptyMonths(),
        yearTotal: 0,
      },
    };

    for (const row of typedRows) {
      const monthIndex = Math.max(0, Math.min(11, row.month - 1));
      const amount = Number(row.total);
      if (!Number.isFinite(amount)) {
        continue;
      }

      const typeMap = byType[row.type];
      let categoryNode = typeMap.get(row.categoryId);
      if (!categoryNode) {
        categoryNode = {
          categoryId: row.categoryId,
          categoryName: row.categoryName,
          months: this.emptyMonths(),
          yearTotal: 0,
          subcategories: [],
        };
        typeMap.set(row.categoryId, categoryNode);
      }

      categoryNode.months[monthIndex] += amount;
      categoryNode.yearTotal += amount;

      const resolvedSubcategory = this.resolveSubcategoryRow(row);
      let subcategoryNode = categoryNode.subcategories.find(
        (sub) => sub.subcategoryId === resolvedSubcategory.subcategoryId,
      );
      if (!subcategoryNode) {
        subcategoryNode = {
          subcategoryId: resolvedSubcategory.subcategoryId,
          subcategoryName: resolvedSubcategory.subcategoryName,
          months: this.emptyMonths(),
          yearTotal: 0,
        };
        categoryNode.subcategories.push(subcategoryNode);
      }

      subcategoryNode.months[monthIndex] += amount;
      subcategoryNode.yearTotal += amount;

      totals[row.type].months[monthIndex] += amount;
      totals[row.type].yearTotal += amount;
    }

    const normalizeType = (type: TrialBalanceType) =>
      Array.from(byType[type].values())
        .map((category) => ({
          ...category,
          months: category.months.map((value) => Number(value)),
          yearTotal: Number(this.sumYear(category.months)),
          subcategories: [...category.subcategories]
            .map((subcategory) => ({
              ...subcategory,
              months: subcategory.months.map((value) => Number(value)),
              yearTotal: Number(this.sumYear(subcategory.months)),
            }))
            .sort((a, b) =>
              a.subcategoryName.localeCompare(b.subcategoryName, "pt-BR", {
                sensitivity: "base",
              }),
            ),
        }))
        .sort((a, b) =>
          a.categoryName.localeCompare(b.categoryName, "pt-BR", { sensitivity: "base" }),
        );

    return {
      year,
      accountIds: requestedAccountIds,
      income: normalizeType("income"),
      expense: normalizeType("expense"),
      totals: {
        income: {
          months: totals.income.months.map((value) => Number(value)),
          yearTotal: Number(this.sumYear(totals.income.months)),
        },
        expense: {
          months: totals.expense.months.map((value) => Number(value)),
          yearTotal: Number(this.sumYear(totals.expense.months)),
        },
      },
    };
  }
}
