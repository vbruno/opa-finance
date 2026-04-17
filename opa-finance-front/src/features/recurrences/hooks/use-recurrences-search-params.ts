import type {
  RecurrencesNavigateFn,
  RecurrencesSearchParams,
  RecurrencesSetSearchInput,
} from '@/features/recurrences/model/recurrences.types'

type UseRecurrencesSearchParamsParams = {
  search: RecurrencesSearchParams
  navigate: RecurrencesNavigateFn
}

export function useRecurrencesSearchParams({
  search,
  navigate,
}: UseRecurrencesSearchParamsParams) {
  const page = search.page ?? 1
  const limit = search.limit ?? 20

  function setSearch(next: RecurrencesSetSearchInput) {
    navigate({
      search: (prev) => ({
        ...prev,
        ...next,
      }),
    })
  }

  return {
    page,
    limit,
    setSearch,
  }
}
