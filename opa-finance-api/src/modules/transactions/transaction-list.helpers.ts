import { asc, desc, eq, gt, gte, lt, lte } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import { accounts, categories, subcategories, transactions } from "../../db/schema";

import { TransactionType } from "./transaction.enums";
import type { ListTransactionsQuery } from "./transaction.schemas";

export function appendTransactionAmountFilters(filters: SQL[], query: ListTransactionsQuery) {
  if (query.amountOp && query.amount !== undefined) {
    const amountValue = query.amount.toString();
    switch (query.amountOp) {
      case "gt":
        filters.push(gt(transactions.amount, amountValue));
        break;
      case "gte":
        filters.push(gte(transactions.amount, amountValue));
        break;
      case "lt":
        filters.push(lt(transactions.amount, amountValue));
        break;
      case "lte":
        filters.push(lte(transactions.amount, amountValue));
        break;
    }
    return;
  }

  if (query.amountMin !== undefined && query.amountMax !== undefined) {
    filters.push(gte(transactions.amount, query.amountMin.toString()));
    filters.push(lte(transactions.amount, query.amountMax.toString()));
    return;
  }

  if (query.amount !== undefined) {
    filters.push(eq(transactions.amount, query.amount.toString()));
  }
}

export function buildTransactionOrderBy(query: ListTransactionsQuery) {
  const sortKey = query.sort ?? "date";
  const sortDirection = query.dir === "asc" ? asc : desc;

  switch (sortKey) {
    case "amount":
      return [sortDirection(transactions.amount), desc(transactions.createdAt)];
    case "type":
      return [sortDirection(transactions.type), desc(transactions.createdAt)];
    case "description":
      return [sortDirection(transactions.description), desc(transactions.createdAt)];
    case "account":
      return [sortDirection(accounts.name), desc(transactions.createdAt)];
    case "category":
      return [sortDirection(categories.name), desc(transactions.createdAt)];
    case "subcategory":
      return [sortDirection(subcategories.name), desc(transactions.createdAt)];
    case "date":
      return [sortDirection(transactions.date), desc(transactions.createdAt)];
    default:
      return [desc(transactions.date), desc(transactions.createdAt)];
  }
}

export function appendTransactionTypeFilter(filters: SQL[], query: ListTransactionsQuery) {
  if (query.type) {
    filters.push(eq(transactions.type, query.type as TransactionType));
  }
}
