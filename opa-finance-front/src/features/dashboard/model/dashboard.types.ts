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
