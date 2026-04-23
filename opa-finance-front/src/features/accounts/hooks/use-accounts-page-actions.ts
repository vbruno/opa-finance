import { useCallback } from 'react'

import type { AccountsNavigateFn } from '@/features/accounts/model/accounts.types'

type UseAccountsPageActionsInput = {
  navigate: AccountsNavigateFn
  safePage: number
  totalPages: number
  setPageSize: (nextSize: number) => void
  resetCreateForm: () => void
  openCreateModalState: () => void
  closeEditModalState: () => void
}

export function useAccountsPageActions({
  navigate,
  safePage,
  totalPages,
  setPageSize,
  resetCreateForm,
  openCreateModalState,
  closeEditModalState,
}: UseAccountsPageActionsInput) {
  const openAccountById = useCallback(
    (accountId: string) => {
      navigate({
        search: (previous) => ({ ...previous, id: accountId }),
      })
    },
    [navigate],
  )

  const closeAccountDetails = useCallback(() => {
    navigate({
      search: (previous) => ({ ...previous, id: undefined }),
      replace: true,
    })
  }, [navigate])

  const closeEditModal = useCallback(() => {
    closeEditModalState()
    closeAccountDetails()
  }, [closeAccountDetails, closeEditModalState])

  const openCreateModal = useCallback(() => {
    resetCreateForm()
    openCreateModalState()
  }, [openCreateModalState, resetCreateForm])

  const handleSort = useCallback(
    (nextKey: 'name' | 'type' | 'balance') => {
      navigate({
        search: (previous) => {
          const isSame = previous.sort === nextKey
          const nextDirection =
            isSame && previous.dir === 'asc' ? 'desc' : 'asc'
          return {
            ...previous,
            sort: nextKey,
            dir: nextDirection,
          }
        },
        replace: false,
      })
    },
    [navigate],
  )

  const goToFirstPage = useCallback(() => {
    navigate({
      search: (previous) => ({
        ...previous,
        page: 1,
      }),
      replace: false,
    })
  }, [navigate])

  const goToPreviousPage = useCallback(() => {
    navigate({
      search: (previous) => ({
        ...previous,
        page: safePage - 1,
      }),
      replace: false,
    })
  }, [navigate, safePage])

  const goToNextPage = useCallback(() => {
    navigate({
      search: (previous) => ({
        ...previous,
        page: safePage + 1,
      }),
      replace: false,
    })
  }, [navigate, safePage])

  const goToLastPage = useCallback(() => {
    navigate({
      search: (previous) => ({
        ...previous,
        page: totalPages,
      }),
      replace: false,
    })
  }, [navigate, totalPages])

  const handlePageSizeChange = useCallback(
    (nextSize: number) => {
      setPageSize(nextSize)
      goToFirstPage()
    },
    [goToFirstPage, setPageSize],
  )

  return {
    openAccountById,
    closeAccountDetails,
    closeEditModal,
    openCreateModal,
    handleSort,
    handlePageSizeChange,
    goToFirstPage,
    goToPreviousPage,
    goToNextPage,
    goToLastPage,
  }
}
