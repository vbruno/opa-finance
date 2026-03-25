import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'

export type ConsolidatedLine = {
  categoryId: string
  categoryName: string
  months: number[]
  yearTotal: number
  subcategories: {
    subcategoryId: string
    subcategoryName: string
    months: number[]
    yearTotal: number
  }[]
}

export type ConsolidatedResponse = {
  year: number
  accountIds: string[]
  income: ConsolidatedLine[]
  expense: ConsolidatedLine[]
  totals: {
    income: {
      months: number[]
      yearTotal: number
    }
    expense: {
      months: number[]
      yearTotal: number
    }
  }
}

export type ConsolidatedQueryParams = {
  year: number
  accountIds?: string[]
}

export type ConsolidatedYearsQueryParams = {
  accountIds?: string[]
}

export type ConsolidatedYearsResponse = {
  years: number[]
}

export type WeekStart = 'monday' | 'sunday'

export type WeeklyCashflowColumn = {
  id: string
  label: string
  type: 'income' | 'expense'
  scope: 'category' | 'subcategory'
  categoryId: string
  categoryName: string
  subcategoryId: string | null
  subcategoryName: string | null
}

export type WeeklyCashflowWeekRow = {
  week: number
  startDate: string
  endDate: string
  total: number
  received: number
  spent: number
  dynamicValues: Record<string, number>
}

export type WeeklyCashflowResponse = {
  year: number
  weekStart: WeekStart
  appliedAccountIds: string[]
  defaultAccountId: string | null
  summaryColumns: ['total', 'received', 'spent']
  columnsCatalog: WeeklyCashflowColumn[]
  weeks: WeeklyCashflowWeekRow[]
}

export type WeeklyCashflowQueryParams = {
  year: number
  weekStart: WeekStart
  accountIds?: string[]
}

const consolidatedKey = ['consolidated']
const consolidatedYearsKey = ['consolidated-years']
const weeklyCashflowKey = ['weekly-cashflow']

export function useConsolidated(
  params: ConsolidatedQueryParams,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: [...consolidatedKey, params],
    queryFn: async () => {
      const response = await api.get<ConsolidatedResponse>(
        '/reports/consolidated',
        {
          params: {
            year: params.year,
            accountIds: params.accountIds?.length
              ? params.accountIds.join(',')
              : undefined,
          },
        },
      )
      return response.data
    },
    enabled: options?.enabled,
  })
}

export function useConsolidatedYears(
  params?: ConsolidatedYearsQueryParams,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: [...consolidatedYearsKey, params],
    queryFn: async () => {
      const response = await api.get<ConsolidatedYearsResponse>(
        '/reports/consolidated/years',
        {
          params: {
            accountIds: params?.accountIds?.length
              ? params.accountIds.join(',')
              : undefined,
          },
        },
      )
      return response.data
    },
    enabled: options?.enabled,
  })
}

export function useWeeklyCashflow(
  params: WeeklyCashflowQueryParams,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: [...weeklyCashflowKey, params],
    queryFn: async () => {
      const response = await api.get<WeeklyCashflowResponse>(
        '/reports/weekly-cashflow',
        {
          params: {
            year: params.year,
            weekStart: params.weekStart,
            accountIds: params.accountIds?.length
              ? params.accountIds.join(',')
              : undefined,
          },
        },
      )
      return response.data
    },
    enabled: options?.enabled,
  })
}
