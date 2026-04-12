import { useCallback } from 'react'

import type { TransactionsNavigateFn } from './use-transactions-search-params'

type UseTransactionsPaginationInput = {
  page: number
  totalPages: number
  navigate: TransactionsNavigateFn
  setLimitPreference: (value: number) => void
}

export function useTransactionsPagination({
  page,
  totalPages,
  navigate,
  setLimitPreference,
}: UseTransactionsPaginationInput) {
  const handleLimitChange = useCallback(
    (value: string) => {
      const nextLimit = Number(value)
      setLimitPreference(nextLimit)
      navigate({
        search: (prev) => ({
          ...prev,
          limit: nextLimit,
          page: 1,
        }),
      })
    },
    [navigate, setLimitPreference],
  )

  const goToPreviousPage = useCallback(() => {
    navigate({
      search: (prev) => ({
        ...prev,
        page: Math.max(1, page - 1),
      }),
    })
  }, [navigate, page])

  const goToNextPage = useCallback(() => {
    navigate({
      search: (prev) => ({
        ...prev,
        page: Math.min(totalPages, page + 1),
      }),
    })
  }, [navigate, page, totalPages])

  const goToPage = useCallback(
    (targetPage: number) => {
      navigate({
        search: (prev) => ({
          ...prev,
          page: targetPage,
        }),
      })
    },
    [navigate],
  )

  return {
    handleLimitChange,
    goToPreviousPage,
    goToNextPage,
    goToPage,
  }
}
