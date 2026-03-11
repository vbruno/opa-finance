import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'

export type TrialBalanceLine = {
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

export type TrialBalanceResponse = {
  year: number
  accountIds: string[]
  income: TrialBalanceLine[]
  expense: TrialBalanceLine[]
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

export type TrialBalanceQueryParams = {
  year: number
  accountIds?: string[]
}

export type TrialBalanceYearsQueryParams = {
  accountIds?: string[]
}

export type TrialBalanceYearsResponse = {
  years: number[]
}

const trialBalanceKey = ['trial-balance']
const trialBalanceYearsKey = ['trial-balance-years']

export function useTrialBalance(
  params: TrialBalanceQueryParams,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: [...trialBalanceKey, params],
    queryFn: async () => {
      const response = await api.get<TrialBalanceResponse>(
        '/reports/trial-balance',
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

export function useTrialBalanceYears(
  params?: TrialBalanceYearsQueryParams,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: [...trialBalanceYearsKey, params],
    queryFn: async () => {
      const response = await api.get<TrialBalanceYearsResponse>(
        '/reports/trial-balance/years',
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
