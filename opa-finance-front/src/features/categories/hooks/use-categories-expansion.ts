import { useCallback, useEffect, useMemo, useState } from 'react'

import type { Category } from '@/features/categories/categories.api'
import { arraysEqual } from '@/features/categories/model/categories.helpers'

type UseCategoriesExpansionInput = {
  userCategories: Category[]
  normalizedSearch: string
  searchExpandIds: string[]
}

export function useCategoriesExpansion({
  userCategories,
  normalizedSearch,
  searchExpandIds,
}: UseCategoriesExpansionInput) {
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<string[]>([])
  const [hasManualSearchExpandOverride, setHasManualSearchExpandOverride] =
    useState(false)

  const filteredCategoryCount = useMemo(
    () => searchExpandIds.length,
    [searchExpandIds.length],
  )

  useEffect(() => {
    if (expandedCategoryIds.length === 0) {
      return
    }
    const validIds = new Set(userCategories.map((category) => category.id))
    setExpandedCategoryIds((prev) => {
      const next = prev.filter((categoryId) => validIds.has(categoryId))
      return arraysEqual(prev, next) ? prev : next
    })
  }, [expandedCategoryIds.length, userCategories])

  useEffect(() => {
    if (!normalizedSearch.length) {
      if (hasManualSearchExpandOverride) {
        setHasManualSearchExpandOverride(false)
      }
      return
    }
    if (searchExpandIds.length === 0) {
      if (expandedCategoryIds.length > 0) {
        setExpandedCategoryIds([])
      }
      return
    }
    if (hasManualSearchExpandOverride) {
      return
    }
    setExpandedCategoryIds((prev) => {
      if (arraysEqual(prev, searchExpandIds)) {
        return prev
      }
      return searchExpandIds
    })
  }, [
    expandedCategoryIds.length,
    hasManualSearchExpandOverride,
    normalizedSearch,
    searchExpandIds,
  ])

  const toggleCategoryExpansion = useCallback(
    (categoryId: string) => {
      if (normalizedSearch.length > 0) {
        setHasManualSearchExpandOverride(true)
      }
      setExpandedCategoryIds((prev) =>
        prev.includes(categoryId)
          ? prev.filter((id) => id !== categoryId)
          : [...prev, categoryId],
      )
    },
    [normalizedSearch.length],
  )

  const toggleExpandAll = useCallback((categoryIds: string[]) => {
    setHasManualSearchExpandOverride(true)
    const shouldCollapse =
      categoryIds.length > 0 && arraysEqual(expandedCategoryIds, categoryIds)
    setExpandedCategoryIds(shouldCollapse ? [] : categoryIds)
  }, [expandedCategoryIds])

  return {
    expandedCategoryIds,
    filteredCategoryCount,
    toggleCategoryExpansion,
    toggleExpandAll,
    setExpandedCategoryIds,
    setHasManualSearchExpandOverride,
  }
}
