import { useCallback, useEffect, useMemo } from 'react'

import {
  isDashboardPresetPeriod,
  type DashboardPeriod,
} from '../model/dashboard.constants'
import { getDashboardDateRange } from '../model/dashboard.helpers'
import type { DashboardNavigateFn, DashboardSearchParams } from '../model/dashboard.types'

type DashboardAccountInput = {
  id: string
  isPrimary?: boolean
}

type UseDashboardSearchParamsInput = {
  search: DashboardSearchParams
  navigate: DashboardNavigateFn
  dashboardAccounts: DashboardAccountInput[]
  accountsLoaded: boolean
}

export function useDashboardSearchParams({
  search,
  navigate,
  dashboardAccounts,
  accountsLoaded,
}: UseDashboardSearchParamsInput) {
  const period: DashboardPeriod = search.period ?? 'month'
  const accountParam = search.accountId
  const customStartDate = search.startDate ?? ''
  const customEndDate = search.endDate ?? ''

  const primaryAccountId = useMemo(() => {
    return (
      dashboardAccounts.find((account) => account.isPrimary)?.id ??
      dashboardAccounts[0]?.id
    )
  }, [dashboardAccounts])

  const isAccountParamAll = accountParam === 'all'
  const isAccountParamValid = accountParam
    ? dashboardAccounts.some((account) => account.id === accountParam)
    : false
  const resolvedAccountId =
    !accountParam || isAccountParamAll
      ? primaryAccountId
      : isAccountParamValid
        ? accountParam
        : primaryAccountId

  const effectiveAccountId = isAccountParamAll ? '' : resolvedAccountId || ''
  const canQueryAccount =
    accountsLoaded && (isAccountParamAll || Boolean(resolvedAccountId))

  const { startDate, endDate } = getDashboardDateRange(
    period,
    customStartDate,
    customEndDate,
  )

  useEffect(() => {
    if (!accountsLoaded) {
      return
    }
    if (accountParam === undefined && primaryAccountId) {
      navigate({
        search: (prev) => ({
          ...prev,
          accountId: primaryAccountId,
        }),
      })
    }
  }, [accountParam, accountsLoaded, navigate, primaryAccountId])

  useEffect(() => {
    if (!accountsLoaded) {
      return
    }
    if (!accountParam || accountParam === 'all') {
      return
    }
    const hasAccount = dashboardAccounts.some(
      (account) => account.id === accountParam,
    )
    if (!hasAccount) {
      navigate({
        search: (prev) => ({
          ...prev,
          accountId: primaryAccountId ?? undefined,
        }),
        replace: true,
      })
    }
  }, [accountParam, accountsLoaded, dashboardAccounts, navigate, primaryAccountId])

  const handlePeriodChange = useCallback(
    (value: string) => {
      if (value === 'custom') {
        navigate({
          search: (prev) => ({
            ...prev,
            period: 'custom',
            startDate,
            endDate,
          }),
        })
        return
      }

      navigate({
        search: (prev) => ({
          ...prev,
          period: isDashboardPresetPeriod(value) ? value : 'month',
          startDate: undefined,
          endDate: undefined,
        }),
      })
    },
    [endDate, navigate, startDate],
  )

  const handleAccountChange = useCallback(
    (value: string) => {
      navigate({
        search: (prev) => ({
          ...prev,
          accountId: value === 'all' ? 'all' : value || undefined,
        }),
      })
    },
    [navigate],
  )

  const handleCustomDateChange = useCallback(
    (key: 'startDate' | 'endDate', value: string) => {
      navigate({
        search: (prev) => ({
          ...prev,
          [key]: value || undefined,
        }),
      })
    },
    [navigate],
  )

  return {
    period,
    accountParam,
    customStartDate,
    customEndDate,
    startDate,
    endDate,
    primaryAccountId,
    isAccountParamAll,
    resolvedAccountId,
    effectiveAccountId,
    canQueryAccount,
    handlePeriodChange,
    handleAccountChange,
    handleCustomDateChange,
  }
}
