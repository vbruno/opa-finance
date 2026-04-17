import { useEffect, useMemo, useState } from 'react'

export function useConsolidatedExpansion(categoryIds: string[]) {
  const categoryIdsKey = useMemo(() => categoryIds.join('|'), [categoryIds])
  const normalizedCategoryIds = useMemo(
    () => (categoryIdsKey ? categoryIdsKey.split('|') : []),
    [categoryIdsKey],
  )
  const [collapsedCategoryIds, setCollapsedCategoryIds] = useState<Set<string>>(
    () => new Set(normalizedCategoryIds),
  )

  const areAllCollapsed =
    normalizedCategoryIds.length > 0 &&
    normalizedCategoryIds.every((categoryId) => collapsedCategoryIds.has(categoryId))

  useEffect(() => {
    setCollapsedCategoryIds(new Set(normalizedCategoryIds))
  }, [normalizedCategoryIds])

  function toggleCategory(categoryId: string) {
    setCollapsedCategoryIds((previous) => {
      const next = new Set(previous)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }

  function expandAll() {
    setCollapsedCategoryIds(new Set())
  }

  function collapseAll() {
    setCollapsedCategoryIds(new Set(normalizedCategoryIds))
  }

  return {
    collapsedCategoryIds,
    areAllCollapsed,
    toggleCategory,
    expandAll,
    collapseAll,
  }
}
