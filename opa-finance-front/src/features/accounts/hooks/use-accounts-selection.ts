import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { Account } from '@/features/accounts/accounts.api'

type UseAccountsSelectionInput = {
  accounts: Account[]
  filteredAccounts: Account[]
  paginatedAccounts: Account[]
  normalizedSearch: string
  typeFilter: string
  hasOpenModal: boolean
}

export function useAccountsSelection({
  accounts,
  filteredAccounts,
  paginatedAccounts,
  normalizedSearch,
  typeFilter,
  hasOpenModal,
}: UseAccountsSelectionInput) {
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(
    new Set(),
  )
  const selectAllRef = useRef<HTMLInputElement | null>(null)

  const selectedAccounts = useMemo(
    () =>
      filteredAccounts.filter((account) => selectedAccountIds.has(account.id)),
    [filteredAccounts, selectedAccountIds],
  )
  const selectedCount = selectedAccounts.length
  const selectedTotal = selectedAccounts.reduce(
    (total, account) => total + (account.currentBalance ?? 0),
    0,
  )
  const pageIds = paginatedAccounts.map((account) => account.id)
  const selectedOnPageCount = pageIds.filter((id) =>
    selectedAccountIds.has(id),
  ).length
  const allSelectedOnPage =
    pageIds.length > 0 && selectedOnPageCount === pageIds.length
  const hasSelectionOnPage = selectedOnPageCount > 0

  const toggleSelectAllOnPage = useCallback(
    (checked: boolean) => {
      setSelectedAccountIds((prev) => {
        const next = new Set(prev)
        if (checked) {
          pageIds.forEach((id) => next.add(id))
        } else {
          pageIds.forEach((id) => next.delete(id))
        }
        return next
      })
    },
    [pageIds],
  )

  const toggleSelectAccount = useCallback((accountId: string) => {
    setSelectedAccountIds((prev) => {
      const next = new Set(prev)
      if (next.has(accountId)) {
        next.delete(accountId)
      } else {
        next.add(accountId)
      }
      return next
    })
  }, [])

  const setAccountSelected = useCallback((accountId: string, checked: boolean) => {
    setSelectedAccountIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(accountId)
      } else {
        next.delete(accountId)
      }
      return next
    })
  }, [])

  useEffect(() => {
    setSelectedAccountIds(new Set())
  }, [normalizedSearch, typeFilter])

  useEffect(() => {
    if (!selectAllRef.current) {
      return
    }
    selectAllRef.current.indeterminate =
      hasSelectionOnPage && !allSelectedOnPage
  }, [allSelectedOnPage, hasSelectionOnPage])

  useEffect(() => {
    setSelectedAccountIds((prev) => {
      if (prev.size === 0) {
        return prev
      }
      const validIds = new Set(accounts.map((account) => account.id))
      const next = new Set([...prev].filter((id) => validIds.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [accounts])

  useEffect(() => {
    if (hasOpenModal || selectedAccountIds.size === 0) {
      return
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }
      setSelectedAccountIds(new Set())
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [hasOpenModal, selectedAccountIds.size])

  return {
    selectedAccountIds,
    selectedCount,
    selectedTotal,
    allSelectedOnPage,
    selectAllRef,
    toggleSelectAllOnPage,
    toggleSelectAccount,
    setAccountSelected,
  }
}
