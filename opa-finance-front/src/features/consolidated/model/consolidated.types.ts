export type ConsolidatedSearchParams = {
  year?: number
  accountIds?: string
}

type ConsolidatedNavigateSearch = {
  search: (
    previous: ConsolidatedSearchParams,
  ) => ConsolidatedSearchParams
  replace?: boolean
}

export type ConsolidatedNavigateFn = (
  options: ConsolidatedNavigateSearch,
) => void

export type ConsolidatedSectionTone = 'income' | 'expense'
