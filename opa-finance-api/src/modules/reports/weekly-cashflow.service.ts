import { and, eq, gte, inArray, lte } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

import { ForbiddenProblem } from "../../core/errors/problems";
import { accounts, categories, subcategories, transactions } from "../../db/schema";
import type {
  WeekStart,
  WeeklyCashflowColumn,
  WeeklyCashflowQuery,
  WeeklyCashflowResponse,
} from "./weekly-cashflow.schemas";

type TransactionRow = {
  date: string;
  type: "income" | "expense";
  amount: string;
  categoryId: string;
  categoryName: string;
  subcategoryId: string | null;
  subcategoryName: string | null;
};

type OwnedAccount = {
  id: string;
  isPrimary: boolean;
  createdAt: Date | null;
};

export class WeeklyCashflowService {
  constructor(private app: FastifyInstance) {}

  private toUtcDate(date: string) {
    return new Date(`${date}T00:00:00.000Z`);
  }

  private formatUtcDate(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private startOfWeek(date: Date, weekStart: WeekStart) {
    const cloned = new Date(date.getTime());
    const currentDay = cloned.getUTCDay();
    const offset = weekStart === "monday" ? (currentDay + 6) % 7 : currentDay;
    cloned.setUTCDate(cloned.getUTCDate() - offset);
    return cloned;
  }

  private endOfWeek(date: Date, weekStart: WeekStart) {
    const start = this.startOfWeek(date, weekStart);
    const end = new Date(start.getTime());
    end.setUTCDate(end.getUTCDate() + 6);
    return end;
  }

  private addDays(date: Date, days: number) {
    const next = new Date(date.getTime());
    next.setUTCDate(next.getUTCDate() + days);
    return next;
  }

  private parseAmount(value: string) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private ensureUserOwnsAllAccounts(
    inputAccountIds: string[],
    ownedAccounts: Array<{ id: string }>,
  ) {
    if (inputAccountIds.length === 0) {
      return;
    }

    const ownedSet = new Set(ownedAccounts.map((account) => account.id));
    const hasForeignAccount = inputAccountIds.some((accountId) => !ownedSet.has(accountId));
    if (hasForeignAccount) {
      throw new ForbiddenProblem(
        "Uma ou mais contas informadas não pertencem ao usuário.",
        "/reports/weekly-cashflow",
      );
    }
  }

  private resolveDefaultAccountId(ownedAccounts: OwnedAccount[]) {
    if (ownedAccounts.length === 0) {
      return null;
    }

    const primary = ownedAccounts.find((account) => account.isPrimary);
    if (primary) {
      return primary.id;
    }

    const ordered = [...ownedAccounts].sort((a, b) => {
      const aDate = a.createdAt?.getTime() ?? 0;
      const bDate = b.createdAt?.getTime() ?? 0;
      return aDate - bDate;
    });
    return ordered[0]?.id ?? ownedAccounts[0].id;
  }

  private buildWeeks(year: number, weekStart: WeekStart) {
    const jan1 = this.toUtcDate(`${year}-01-01`);
    const dec31 = this.toUtcDate(`${year}-12-31`);
    const rangeStart = this.startOfWeek(jan1, weekStart);
    const rangeEnd = this.endOfWeek(dec31, weekStart);

    const weeks: Array<{
      week: number;
      startDate: string;
      endDate: string;
      total: number;
      received: number;
      spent: number;
      dynamicValues: Record<string, number>;
    }> = [];

    let cursor = new Date(rangeStart.getTime());
    let week = 1;
    while (cursor.getTime() <= rangeEnd.getTime()) {
      const start = new Date(cursor.getTime());
      const end = this.addDays(start, 6);
      weeks.push({
        week,
        startDate: this.formatUtcDate(start),
        endDate: this.formatUtcDate(end),
        total: 0,
        received: 0,
        spent: 0,
        dynamicValues: {},
      });
      cursor = this.addDays(cursor, 7);
      week += 1;
    }

    return weeks;
  }

  private getColumnId(row: TransactionRow) {
    if (row.subcategoryId) {
      return `subcat:${row.subcategoryId}`;
    }
    return `cat:${row.categoryId}:no-subcategory`;
  }

  private getColumnFromRow(row: TransactionRow): WeeklyCashflowColumn {
    const id = this.getColumnId(row);
    return {
      id,
      label: row.subcategoryName ?? row.categoryName,
      type: row.type,
      scope: row.subcategoryId ? "subcategory" : "category",
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      subcategoryId: row.subcategoryId,
      subcategoryName: row.subcategoryName,
    };
  }

  async get(userId: string, query: WeeklyCashflowQuery): Promise<WeeklyCashflowResponse> {
    const ownedAccounts = await this.app.db
      .select({
        id: accounts.id,
        isPrimary: accounts.isPrimary,
        createdAt: accounts.createdAt,
      })
      .from(accounts)
      .where(eq(accounts.userId, userId));

    const defaultAccountId = this.resolveDefaultAccountId(ownedAccounts);
    const requestedAccountIds = query.accountIds ?? [];

    this.ensureUserOwnsAllAccounts(requestedAccountIds, ownedAccounts);

    const appliedAccountIds =
      requestedAccountIds.length > 0
        ? requestedAccountIds
        : defaultAccountId
          ? [defaultAccountId]
          : [];

    const weeks = this.buildWeeks(query.year, query.weekStart);
    const weekByStartDate = new Map(weeks.map((week) => [week.startDate, week]));

    if (appliedAccountIds.length === 0) {
      return {
        year: query.year,
        weekStart: query.weekStart,
        appliedAccountIds,
        defaultAccountId,
        summaryColumns: ["total", "received", "spent"],
        columnsCatalog: [],
        weeks,
      };
    }

    const startDate = `${query.year}-01-01`;
    const endDate = `${query.year}-12-31`;
    const rows = (await this.app.db
      .select({
        date: transactions.date,
        type: transactions.type,
        amount: transactions.amount,
        categoryId: categories.id,
        categoryName: categories.name,
        subcategoryId: transactions.subcategoryId,
        subcategoryName: subcategories.name,
      })
      .from(transactions)
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
      .leftJoin(subcategories, eq(transactions.subcategoryId, subcategories.id))
      .where(
        and(
          eq(transactions.userId, userId),
          inArray(transactions.accountId, appliedAccountIds),
          gte(transactions.date, startDate),
          lte(transactions.date, endDate),
        ),
      )) as TransactionRow[];

    const columnsCatalogMap = new Map<string, WeeklyCashflowColumn>();

    for (const row of rows) {
      const rowDate = this.toUtcDate(row.date);
      const weekStartDate = this.formatUtcDate(this.startOfWeek(rowDate, query.weekStart));
      const week = weekByStartDate.get(weekStartDate);
      if (!week) {
        continue;
      }

      const amount = this.parseAmount(row.amount);
      if (row.type === "income") {
        week.received += amount;
      } else {
        week.spent += amount;
      }

      const column = this.getColumnFromRow(row);
      columnsCatalogMap.set(column.id, column);
      week.dynamicValues[column.id] = (week.dynamicValues[column.id] ?? 0) + amount;
    }

    for (const week of weeks) {
      week.total = Number((week.received - week.spent).toFixed(2));
      week.received = Number(week.received.toFixed(2));
      week.spent = Number(week.spent.toFixed(2));
      week.dynamicValues = Object.fromEntries(
        Object.entries(week.dynamicValues).map(([key, value]) => [key, Number(value.toFixed(2))]),
      );
    }

    const columnsCatalog = Array.from(columnsCatalogMap.values()).sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "income" ? -1 : 1;
      }

      const categoryOrder = a.categoryName.localeCompare(b.categoryName, "pt-BR", {
        sensitivity: "base",
      });
      if (categoryOrder !== 0) {
        return categoryOrder;
      }

      return a.label.localeCompare(b.label, "pt-BR", {
        sensitivity: "base",
      });
    });

    return {
      year: query.year,
      weekStart: query.weekStart,
      appliedAccountIds,
      defaultAccountId,
      summaryColumns: ["total", "received", "spent"],
      columnsCatalog,
      weeks,
    };
  }
}
