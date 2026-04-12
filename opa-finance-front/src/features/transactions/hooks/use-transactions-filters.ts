import { useEffect } from 'react'

import type { TransactionsQueryParams } from '../transactions.api'

import type {
  TransactionsNavigateFn,
  TransactionsSearchParams,
} from './use-transactions-search-params'

type SortDirection = NonNullable<TransactionsQueryParams['dir']>
type SortKey = TransactionsQueryParams['sort'] | null

type UseTransactionsFiltersInput = {
  search: TransactionsSearchParams
  navigate: TransactionsNavigateFn
  page: number
  limit: number
  sortKey: SortKey
  sortDirection: SortDirection
  totalPages: number
  hasLoadedPageData: boolean
}

export function useTransactionsFilters({
  search,
  navigate,
  page,
  limit,
  sortKey,
  sortDirection,
  totalPages,
  hasLoadedPageData,
}: UseTransactionsFiltersInput) {
  useEffect(() => {
    if (!hasLoadedPageData) {
      return
    }

    const nextPage = totalPages > 0 ? Math.min(page, totalPages) : page
    const nextSort = sortKey ?? 'date'
    const nextDirection = sortKey ? sortDirection : 'desc'
    const shouldSyncSearch =
      search.page !== nextPage ||
      search.limit !== limit ||
      search.sort !== nextSort ||
      search.dir !== nextDirection

    if (!shouldSyncSearch) {
      return
    }

    navigate({
      search: (prev) => ({
        ...prev,
        page: nextPage,
        limit,
        sort: nextSort,
        dir: nextDirection,
      }),
      replace: true,
    })
  }, [
    limit,
    navigate,
    page,
    search.dir,
    search.limit,
    search.page,
    search.sort,
    sortDirection,
    sortKey,
    totalPages,
    hasLoadedPageData,
  ])
}
