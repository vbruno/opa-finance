import { useEffect, useState } from 'react'

import { isCategoryType } from '@/features/categories/model/categories.constants'
import { normalizeSearch } from '@/features/categories/model/categories.helpers'
import type {
  CategoriesNavigateFn,
  CategoriesSearchParams,
} from '@/features/categories/model/categories.types'

type UseCategoriesSearchParamsInput = {
  search: CategoriesSearchParams
  navigate: CategoriesNavigateFn
}

export function useCategoriesSearchParams({
  search,
  navigate,
}: UseCategoriesSearchParamsInput) {
  const searchTerm = search.q ?? ''
  const typeFilter = search.type ?? ''
  const hasActiveFilters = !!searchTerm || !!typeFilter
  const normalizedSearch = normalizeSearch(searchTerm)
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 300)
  const debouncedNormalizedSearch = normalizeSearch(debouncedSearchTerm)

  const setSearchValue = (value: string, replace: boolean) => {
    navigate({
      search: (prev) => ({
        ...prev,
        q: value.trim() ? value : undefined,
      }),
      replace,
    })
  }

  const setTypeValue = (value: string) => {
    navigate({
      search: (prev) => ({
        ...prev,
        type: value && isCategoryType(value) ? value : undefined,
      }),
      replace: false,
    })
  }

  const clearFilters = () => {
    navigate({
      search: () => ({}),
      replace: false,
    })
  }

  return {
    searchTerm,
    typeFilter,
    hasActiveFilters,
    normalizedSearch,
    debouncedNormalizedSearch,
    setSearchValue,
    setTypeValue,
    clearFilters,
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
