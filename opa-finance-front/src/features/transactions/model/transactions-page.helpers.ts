import type { Account } from '@/features/accounts/accounts.api'
import type { Category, Subcategory } from '@/features/categories'
import { normalizeText } from '@/features/transactions/model/transactions.helpers'

export type CategoryTreeOption = {
  value: string
  label: string
  level: 'category' | 'subcategory'
}

type BuildCategoryTreeOptionsInput = {
  categories: Category[]
  subcategoriesByCategory: Record<string, Subcategory[]>
  search: string
}

type BuildDescriptionSuggestionsInput = {
  baseItems: string[]
  filteredItems: string[]
  shouldFilter: boolean
  queryText: string
  limit?: number
}

export function resolveDefaultTransferToAccountId(
  accounts: Account[],
  primaryAccountId: string,
) {
  if (!primaryAccountId || accounts.length <= 1) {
    return ''
  }

  const primaryIndex = accounts.findIndex(
    (account) => account.id === primaryAccountId,
  )
  if (primaryIndex < 0) {
    return accounts[0]?.id ?? ''
  }

  for (let index = primaryIndex + 1; index < accounts.length; index += 1) {
    const candidateId = accounts[index]?.id
    if (candidateId && candidateId !== primaryAccountId) {
      return candidateId
    }
  }

  for (let index = 0; index < primaryIndex; index += 1) {
    const candidateId = accounts[index]?.id
    if (candidateId && candidateId !== primaryAccountId) {
      return candidateId
    }
  }

  return ''
}

export function buildCategoryTreeOptions({
  categories,
  subcategoriesByCategory,
  search,
}: BuildCategoryTreeOptionsInput): CategoryTreeOption[] {
  const query = normalizeText(search.trim())
  const options: CategoryTreeOption[] = []

  categories.forEach((category) => {
    const subcategories = subcategoriesByCategory[category.id] ?? []
    const categoryMatches = normalizeText(category.name).includes(query)
    const matchedSubcategories = query
      ? subcategories.filter((subcategory) =>
          normalizeText(subcategory.name).includes(query),
        )
      : subcategories

    if (query && !categoryMatches && matchedSubcategories.length === 0) {
      return
    }

    options.push({
      value: `category:${category.id}`,
      label: category.name,
      level: 'category',
    })

    matchedSubcategories.forEach((subcategory) => {
      options.push({
        value: `subcategory:${category.id}:${subcategory.id}`,
        label: `${subcategory.name} · ${category.name}`,
        level: 'subcategory',
      })
    })
  })

  return options
}

export function buildDescriptionSuggestions({
  baseItems,
  filteredItems,
  shouldFilter,
  queryText,
  limit = 5,
}: BuildDescriptionSuggestionsInput) {
  if (!shouldFilter) {
    return baseItems.slice(0, limit)
  }
  if (filteredItems.length > 0) {
    return filteredItems.slice(0, limit)
  }
  const query = normalizeText(queryText.trim())
  const fallbackFiltered = baseItems.filter((item) =>
    normalizeText(item).includes(query),
  )
  return fallbackFiltered.slice(0, limit)
}
