import { useEffect, useRef, useState } from 'react'

import { isAccountType } from '@/features/accounts/model/accounts.constants'
import { normalizeAccountsSearch } from '@/features/accounts/model/accounts.helpers'
import type {
  AccountsNavigateFn,
  AccountsSearchParams,
  AccountsSortDirection,
  AccountsSortKey,
} from '@/features/accounts/model/accounts.types'

type UseAccountsSearchParamsInput = {
  search: AccountsSearchParams
  navigate: AccountsNavigateFn
}

export function useAccountsSearchParams({
  search,
  navigate,
}: UseAccountsSearchParamsInput) {
  const ignoreSearchSyncRef = useRef(false)
  const ignoreDebouncedSearchRef = useRef(false)

  const searchTerm = search.q ?? ''
  const [searchDraft, setSearchDraft] = useState(searchTerm)
  const debouncedSearch = useDebouncedValue(searchDraft, 300)
  const typeFilter = search.type ?? ''
  const selectedAccountId = search.id ?? null
  const sortKey: AccountsSortKey = search.sort ?? null
  const sortDirection: AccountsSortDirection = search.dir ?? 'asc'
  const currentPage = search.page ?? 1
  const hasActiveFilters = searchDraft.trim() !== '' || typeFilter !== ''
  const normalizedSearch = normalizeAccountsSearch(searchTerm)

  useEffect(() => {
    if (ignoreSearchSyncRef.current) {
      ignoreSearchSyncRef.current = false
      return
    }
    setSearchDraft(searchTerm)
  }, [searchTerm])

  useEffect(() => {
    if (ignoreDebouncedSearchRef.current) {
      ignoreDebouncedSearchRef.current = false
      return
    }
    if (debouncedSearch === searchTerm) {
      return
    }
    const trimmedValue = debouncedSearch.trim()
    navigate({
      search: (prev) => ({
        ...prev,
        q: trimmedValue ? trimmedValue : undefined,
      }),
      replace: true,
    })
  }, [debouncedSearch, navigate, searchTerm])

  const handleSearchEnter = (value: string) => {
    const trimmedValue = value.trim()
    setSearchDraft(value)
    navigate({
      search: (prev) => ({
        ...prev,
        q: trimmedValue ? trimmedValue : undefined,
      }),
      replace: false,
    })
  }

  const handleTypeFilterChange = (value: string) => {
    navigate({
      search: (prev) => ({
        ...prev,
        type: value && isAccountType(value) ? value : undefined,
      }),
      replace: false,
    })
  }

  const handleClearFilters = () => {
    ignoreSearchSyncRef.current = true
    ignoreDebouncedSearchRef.current = true
    setSearchDraft('')
    navigate({
      search: () => ({}),
      replace: false,
    })
  }

  return {
    searchTerm,
    searchDraft,
    setSearchDraft,
    typeFilter,
    selectedAccountId,
    sortKey,
    sortDirection,
    currentPage,
    hasActiveFilters,
    normalizedSearch,
    handleSearchEnter,
    handleTypeFilterChange,
    handleClearFilters,
  }
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedValue(value)
    }, delayMs)
    return () => window.clearTimeout(timeoutId)
  }, [value, delayMs])

  return debouncedValue
}
