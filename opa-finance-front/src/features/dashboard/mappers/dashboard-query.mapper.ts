import type {
  TopCategoriesGroupBy,
  TopCategoriesQueryParams,
  TransactionsQueryParams,
  TransactionsSummaryQueryParams,
} from '@/features/transactions/transactions.api'

type DashboardBaseQueryInput = {
  startDate: string
  endDate: string
  isAccountParamAll: boolean
  resolvedAccountId?: string
}

type SelectedTopCategory = {
  id: string
  groupBy: TopCategoriesGroupBy
  type: 'income' | 'expense'
}

export function buildDashboardBaseQueryParams({
  startDate,
  endDate,
  isAccountParamAll,
  resolvedAccountId,
}: DashboardBaseQueryInput) {
  return {
    startDate,
    endDate,
    accountId: isAccountParamAll ? undefined : resolvedAccountId || undefined,
    excludeHiddenAccounts: true,
  } as const
}

export function buildDashboardSummaryQueryParams(
  base: ReturnType<typeof buildDashboardBaseQueryParams>,
): TransactionsSummaryQueryParams {
  return {
    ...base,
  }
}

export function buildDashboardRecentTransactionsQueryParams(
  base: ReturnType<typeof buildDashboardBaseQueryParams>,
): TransactionsQueryParams {
  return {
    ...base,
    page: 1,
    limit: 5,
    sort: 'date',
    dir: 'desc',
  }
}

export function buildDashboardTopCategoriesQueryParams(
  base: ReturnType<typeof buildDashboardBaseQueryParams>,
  options: {
    type: 'income' | 'expense'
    groupBy: TopCategoriesGroupBy
  },
): TopCategoriesQueryParams {
  return {
    ...base,
    type: options.type,
    groupBy: options.groupBy,
  }
}

export function buildDashboardTopCategoryTransactionsQueryParams(
  base: ReturnType<typeof buildDashboardBaseQueryParams>,
  selectedTopCategory: SelectedTopCategory | null,
): TransactionsQueryParams {
  return {
    ...base,
    page: 1,
    limit: 5,
    categoryId:
      selectedTopCategory?.groupBy === 'category'
        ? selectedTopCategory.id
        : undefined,
    subcategoryId:
      selectedTopCategory?.groupBy === 'subcategory'
        ? selectedTopCategory.id
        : undefined,
    type: selectedTopCategory?.type,
    sort: 'date',
    dir: 'desc',
  }
}
