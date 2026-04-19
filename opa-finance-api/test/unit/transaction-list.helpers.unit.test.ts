import { describe, expect, it } from "vitest";

import {
  appendTransactionAmountFilters,
  appendTransactionTypeFilter,
  buildTransactionOrderBy,
} from "../../src/modules/transactions/transaction-list.helpers";
import type { ListTransactionsQuery } from "../../src/modules/transactions/transaction.schemas";

describe("transaction-list.helpers", () => {
  it("appendTransactionAmountFilters aplica filtro exato de amount", () => {
    const filters: unknown[] = [];

    appendTransactionAmountFilters(
      filters as never[],
      {
        amount: 120.5,
      } as ListTransactionsQuery,
    );

    expect(filters).toHaveLength(1);
  });

  it("appendTransactionAmountFilters aplica range quando amountMin/amountMax existem", () => {
    const filters: unknown[] = [];

    appendTransactionAmountFilters(
      filters as never[],
      {
        amountMin: 10,
        amountMax: 20,
      } as ListTransactionsQuery,
    );

    expect(filters).toHaveLength(2);
  });

  it("appendTransactionAmountFilters aplica operador amountOp com amount", () => {
    const filters: unknown[] = [];

    appendTransactionAmountFilters(
      filters as never[],
      {
        amountOp: "gte",
        amount: 200,
      } as ListTransactionsQuery,
    );

    expect(filters).toHaveLength(1);
  });

  it("appendTransactionTypeFilter aplica filtro de tipo", () => {
    const filters: unknown[] = [];

    appendTransactionTypeFilter(
      filters as never[],
      {
        type: "expense",
      } as ListTransactionsQuery,
    );

    expect(filters).toHaveLength(1);
  });

  it("buildTransactionOrderBy retorna orderBy padrão com 2 colunas", () => {
    const orderBy = buildTransactionOrderBy({} as ListTransactionsQuery);
    expect(orderBy).toHaveLength(2);
  });

  it("buildTransactionOrderBy suporta chaves de ordenação conhecidas", () => {
    const keys: Array<NonNullable<ListTransactionsQuery["sort"]>> = [
      "amount",
      "type",
      "description",
      "account",
      "category",
      "subcategory",
      "date",
    ];

    keys.forEach((sort) => {
      const orderBy = buildTransactionOrderBy({
        sort,
        dir: "asc",
      } as ListTransactionsQuery);
      expect(orderBy).toHaveLength(2);
    });
  });
});
