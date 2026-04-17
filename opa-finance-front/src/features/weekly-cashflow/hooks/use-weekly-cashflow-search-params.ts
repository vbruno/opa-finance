import { useCallback, useMemo } from 'react'

import type { WeekStart } from '@/features/reports'
import type {
  WeeklyCashflowNavigate,
  WeeklyCashflowSearch,
} from '@/features/weekly-cashflow/model/weekly-cashflow.types'

type Params = {
  search: WeeklyCashflowSearch
  navigate: WeeklyCashflowNavigate
  currentYear: number
  persistedYear?: number
  persistedWeekStart?: WeekStart
  persistedAccountIds?: string[]
  allAccountIds: string[]
  primaryAccountId: string | null
}

export function useWeeklyCashflowSearchParams({
  search,
  navigate,
  currentYear,
  persistedYear,
  persistedWeekStart,
  persistedAccountIds,
  allAccountIds,
  primaryAccountId,
}: Params) {
  const year = search.year ?? persistedYear ?? currentYear
  const weekStart = search.weekStart ?? persistedWeekStart ?? ('monday' as WeekStart)

  const selectedAccountIds = useMemo(() => {
    const idsFromSearch = search.accountIds
      ? search.accountIds
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
      : []
    const sourceIds = idsFromSearch.length > 0 ? idsFromSearch : (persistedAccountIds ?? [])
    const validIds = new Set(allAccountIds)
    const sanitized = sourceIds.filter((id) => validIds.has(id))

    if (sanitized.length > 0) {
      return Array.from(new Set(sanitized))
    }
    if (primaryAccountId) {
      return [primaryAccountId]
    }
    return []
  }, [allAccountIds, persistedAccountIds, primaryAccountId, search.accountIds])

  const setSearch = useCallback(
    (
      next: Partial<{
        year: number
        weekStart: WeekStart
        accountIds: string | undefined
      }>,
    ) => {
      navigate({
        search: (prev) => ({
          ...prev,
          ...next,
        }),
        replace: true,
      })
    },
    [navigate],
  )

  const updateSelectedAccounts = useCallback(
    (nextIds: string[]) => {
      const validIds = nextIds.filter((id) => allAccountIds.includes(id))
      if (validIds.length === 0) {
        setSearch({ accountIds: primaryAccountId ?? undefined })
        return
      }
      setSearch({ accountIds: validIds.join(',') })
    },
    [allAccountIds, primaryAccountId, setSearch],
  )

  const toggleAccount = useCallback(
    (accountId: string) => {
      const selectedSet = new Set(selectedAccountIds)
      if (selectedSet.has(accountId)) {
        selectedSet.delete(accountId)
      } else {
        selectedSet.add(accountId)
      }
      updateSelectedAccounts(allAccountIds.filter((id) => selectedSet.has(id)))
    },
    [allAccountIds, selectedAccountIds, updateSelectedAccounts],
  )

  return {
    year,
    weekStart,
    selectedAccountIds,
    setSearch,
    updateSelectedAccounts,
    toggleAccount,
  }
}
