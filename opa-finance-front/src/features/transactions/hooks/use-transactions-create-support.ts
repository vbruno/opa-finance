import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { type Account } from '@/features/accounts'
import {
  fetchSubcategories,
  type Category,
  type Subcategory,
} from '@/features/categories'
import {
  buildCategoryTreeOptions,
  buildDescriptionSuggestions,
} from '@/features/transactions/model/transactions-page.helpers'
import { useTransactionDescriptions } from '@/features/transactions/transactions.api'

type UseTransactionsCreateSupportParams = {
  availableCategories: Category[]
  createCategoryIdsKey: string
  createCategoryId: string
  createSubcategoryId: string
  createAccountId: string
  createCategoryTreeSearch: string
  editCategoryTreeSearch: string
  debouncedCreateDescription: string
  isCreateOpen: boolean
  isEditOpen: boolean
  lastCreatedSubcategory: Subcategory | null
  accounts: Account[]
}

export function useTransactionsCreateSupport({
  availableCategories,
  createCategoryIdsKey,
  createCategoryId,
  createSubcategoryId,
  createAccountId,
  createCategoryTreeSearch,
  editCategoryTreeSearch,
  debouncedCreateDescription,
  isCreateOpen,
  isEditOpen,
  lastCreatedSubcategory,
  accounts,
}: UseTransactionsCreateSupportParams) {
  const createAllSubcategoriesQuery = useQuery({
    queryKey: ['subcategories', 'transaction-create-all', createCategoryIdsKey],
    queryFn: async () => {
      const entries = await Promise.all(
        availableCategories.map(async (category) => {
          const subcategories = await fetchSubcategories(category.id)
          return [category.id, subcategories] as const
        }),
      )
      return Object.fromEntries(entries) as Record<string, Subcategory[]>
    },
    enabled: Boolean((isCreateOpen || isEditOpen) && availableCategories.length),
  })

  const createSubcategoriesByCategory = useMemo(() => {
    const source = createAllSubcategoriesQuery.data ?? {}
    const next: Record<string, Subcategory[]> = {}
    Object.entries(source).forEach(([categoryId, items]) => {
      next[categoryId] = [...items].sort((a, b) =>
        a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }),
      )
    })

    if (lastCreatedSubcategory) {
      const list = next[lastCreatedSubcategory.categoryId] ?? []
      if (!list.some((item) => item.id === lastCreatedSubcategory.id)) {
        next[lastCreatedSubcategory.categoryId] = [
          ...list,
          lastCreatedSubcategory,
        ].sort((a, b) =>
          a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }),
        )
      }
    }

    return next
  }, [createAllSubcategoriesQuery.data, lastCreatedSubcategory])

  const createSubcategories = useMemo(
    () => createSubcategoriesByCategory[createCategoryId] ?? [],
    [createCategoryId, createSubcategoriesByCategory],
  )

  const createSubcategoryName = useMemo(
    () =>
      createSubcategories.find((subcategory) => subcategory.id === createSubcategoryId)
        ?.name ?? '',
    [createSubcategories, createSubcategoryId],
  )

  const createAccountName = useMemo(
    () => accounts.find((account) => account.id === createAccountId)?.name ?? '',
    [accounts, createAccountId],
  )

  const createCategoryTreeOptions = useMemo(
    () =>
      buildCategoryTreeOptions({
        categories: availableCategories,
        subcategoriesByCategory: createSubcategoriesByCategory,
        search: createCategoryTreeSearch,
      }),
    [
      availableCategories,
      createCategoryTreeSearch,
      createSubcategoriesByCategory,
    ],
  )

  const editCategoryTreeOptions = useMemo(
    () =>
      buildCategoryTreeOptions({
        categories: availableCategories,
        subcategoriesByCategory: createSubcategoriesByCategory,
        search: editCategoryTreeSearch,
      }),
    [
      availableCategories,
      createSubcategoriesByCategory,
      editCategoryTreeSearch,
    ],
  )

  const suggestionsQueryText = debouncedCreateDescription
  const trimmedSuggestionsQueryText = suggestionsQueryText.trim()
  const shouldFilterSuggestions =
    /\s/.test(suggestionsQueryText) || trimmedSuggestionsQueryText.length > 0

  const baseDescriptionSuggestionsQuery = useTransactionDescriptions(
    {
      accountId: createAccountId || '',
      limit: 20,
    },
    {
      enabled: Boolean((isCreateOpen || isEditOpen) && createAccountId),
    },
  )

  const filteredDescriptionSuggestionsQuery = useTransactionDescriptions(
    {
      accountId: createAccountId || '',
      q: shouldFilterSuggestions ? trimmedSuggestionsQueryText : undefined,
      limit: 20,
    },
    {
      enabled: Boolean((isCreateOpen || isEditOpen) && createAccountId && shouldFilterSuggestions),
    },
  )

  const descriptionSuggestions = buildDescriptionSuggestions({
    baseItems: baseDescriptionSuggestionsQuery.data?.items ?? [],
    filteredItems: filteredDescriptionSuggestionsQuery.data?.items ?? [],
    shouldFilter: shouldFilterSuggestions,
    queryText: trimmedSuggestionsQueryText,
  })

  return {
    createSubcategoriesByCategory,
    createSubcategories,
    createSubcategoryName,
    createAccountName,
    createCategoryTreeOptions,
    editCategoryTreeOptions,
    descriptionSuggestions,
    areDescriptionSuggestionsLoading:
      filteredDescriptionSuggestionsQuery.isLoading ||
      baseDescriptionSuggestionsQuery.isLoading,
    hasDescriptionSuggestionsError:
      filteredDescriptionSuggestionsQuery.isError ||
      baseDescriptionSuggestionsQuery.isError,
    shouldFilterSuggestions,
  }
}
