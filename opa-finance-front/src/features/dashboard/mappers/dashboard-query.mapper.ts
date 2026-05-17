import type {
  CashflowGranularity,
  CashflowQueryParams,
  CategoryBreakdownQueryParams,
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

export function resolveCashflowGranularity(
  startDate: string,
  endDate: string,
): CashflowGranularity {
  const start = new Date(`${startDate}T00:00:00Z`).getTime()
  const end = new Date(`${endDate}T00:00:00Z`).getTime()
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return 'day'
  }
  const days = Math.floor((end - start) / (24 * 60 * 60 * 1000)) + 1
  if (days <= 31) return 'day'
  if (days <= 90) return 'week'
  return 'month'
}

export function buildDashboardCashflowQueryParams(
  base: ReturnType<typeof buildDashboardBaseQueryParams>,
): CashflowQueryParams {
  return {
    startDate: base.startDate,
    endDate: base.endDate,
    accountId: base.accountId,
    excludeHiddenAccounts: base.excludeHiddenAccounts,
    granularity: resolveCashflowGranularity(base.startDate, base.endDate),
  }
}

export function buildDashboardCategoryBreakdownQueryParams(
  base: ReturnType<typeof buildDashboardBaseQueryParams>,
  options: { type: 'income' | 'expense' },
): CategoryBreakdownQueryParams {
  return {
    startDate: base.startDate,
    endDate: base.endDate,
    accountId: base.accountId,
    excludeHiddenAccounts: base.excludeHiddenAccounts,
    type: options.type,
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
