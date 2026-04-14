import type { DashboardPeriod } from './dashboard.constants'

export type DashboardDateRange = {
  startDate: string
  endDate: string
}

export type DashboardSearchParams = {
  period?: DashboardPeriod
  accountId?: string
  startDate?: string
  endDate?: string
}

type DashboardNavigateSearch = {
  search: (previous: DashboardSearchParams) => DashboardSearchParams
  replace?: boolean
}

export type DashboardNavigateFn = (options: DashboardNavigateSearch) => void
