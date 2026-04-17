import type { RecurrenceFilters } from '@/features/recurrences/model/recurrences.constants'

export type RecurrencesSearchParams = {
  page?: number
  limit?: number
  originType?: RecurrenceFilters['originType']
  status?: RecurrenceFilters['status']
  frequency?: RecurrenceFilters['frequency']
  accountId?: string
  q?: string
}

type RecurrencesNavigateSearch = {
  search: (previous: RecurrencesSearchParams) => RecurrencesSearchParams
  replace?: boolean
}

export type RecurrencesNavigateFn = (options: RecurrencesNavigateSearch) => void

export type RecurrencesSetSearchInput = Partial<{
  page: number
  limit: number
  originType: RecurrencesSearchParams['originType']
  status: RecurrencesSearchParams['status']
  frequency: RecurrencesSearchParams['frequency']
  accountId: string | undefined
  q: string | undefined
}>
