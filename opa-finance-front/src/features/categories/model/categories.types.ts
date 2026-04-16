import type { CATEGORY_TYPE_VALUES } from '@/features/categories/model/categories.constants'

export type CategoryType = (typeof CATEGORY_TYPE_VALUES)[number]

export type CategoriesSearchParams = {
  q?: string
  type?: CategoryType
}

type CategoriesNavigateSearch = {
  search: (previous: CategoriesSearchParams) => CategoriesSearchParams
  replace?: boolean
}

export type CategoriesNavigateFn = (options: CategoriesNavigateSearch) => void
