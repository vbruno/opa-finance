import { useCallback, useMemo, useState } from 'react'

import type { Account } from '@/features/accounts'
import {
  parseAccountIdsParam,
  sanitizeAccountIds,
} from '@/features/consolidated/model/consolidated.helpers'
import type {
  ConsolidatedNavigateFn,
  ConsolidatedSearchParams,
} from '@/features/consolidated/model/consolidated.types'

type UseConsolidatedSearchParamsParams = {
  search: ConsolidatedSearchParams
  navigate: ConsolidatedNavigateFn
  accounts: Account[]
  currentYear: number
}

export function useConsolidatedSearchParams({
  search,
  navigate,
  accounts,
  currentYear,
}: UseConsolidatedSearchParamsParams) {
  const year = search.year ?? currentYear
  const allAccountIds = useMemo(() => accounts.map((account) => account.id), [accounts])
  const primaryAccountId = useMemo(() => {
    const primary = accounts.find((account) => account.isPrimary)
    return primary?.id ?? accounts[0]?.id ?? null
  }, [accounts])

  const selectedAccountIds = useMemo(
    () => parseAccountIdsParam(search.accountIds),
    [search.accountIds],
  )

  const sanitizedAccountIds = useMemo(
    () => sanitizeAccountIds(selectedAccountIds, allAccountIds),
    [allAccountIds, selectedAccountIds],
  )

  const effectiveAccountIds = useMemo(() => {
    if (sanitizedAccountIds?.length) {
      return sanitizedAccountIds
    }
    if (primaryAccountId) {
      return [primaryAccountId]
    }
    return []
  }, [primaryAccountId, sanitizedAccountIds])

  const setSearch = useCallback(
    (
      next: Partial<{
        year: number
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

  function updateSelectedAccounts(nextIds: string[]) {
    if (nextIds.length === 0) {
      setSearch({ accountIds: primaryAccountId ?? undefined })
      return
    }
    setSearch({ accountIds: nextIds.join(',') })
  }

  function toggleAccount(accountId: string) {
    const selectedSet = new Set(effectiveAccountIds)
    if (selectedSet.has(accountId)) {
      selectedSet.delete(accountId)
    } else {
      selectedSet.add(accountId)
    }
    const nextIds = allAccountIds.filter((id) => selectedSet.has(id))
    updateSelectedAccounts(nextIds)
  }

  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false)

  return {
    year,
    allAccountIds,
    primaryAccountId,
    effectiveAccountIds,
    setSearch,
    updateSelectedAccounts,
    toggleAccount,
    isAccountDropdownOpen,
    setIsAccountDropdownOpen,
  }
}
