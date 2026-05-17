import type { CashflowGranularity } from '@/features/transactions/transactions.api'

import type { DashboardPeriod } from './dashboard.constants'

export function getDashboardDateRange(
  period: DashboardPeriod,
  customStartDate: string,
  customEndDate: string,
) {
  const today = new Date()
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  const currentYearStart = new Date(today.getFullYear(), 0, 1)
  const currentYearEnd = new Date(today.getFullYear(), 11, 31)
  const fiscalYearStartYear = today.getMonth() >= 6
    ? today.getFullYear()
    : today.getFullYear() - 1
  const fiscalYearStart = new Date(fiscalYearStartYear, 6, 1)
  const fiscalYearEnd = new Date(fiscalYearStartYear + 1, 5, 30)
  const previousMonthStart = new Date(
    today.getFullYear(),
    today.getMonth() - 1,
    1,
  )
  const previousMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
  const last7Start = new Date(today)
  last7Start.setDate(today.getDate() - 6)
  const last15Start = new Date(today)
  last15Start.setDate(today.getDate() - 14)
  const last30Start = new Date(today)
  last30Start.setDate(today.getDate() - 29)

  if (period === 'previousMonth') {
    return {
      startDate: formatDashboardDateInput(previousMonthStart),
      endDate: formatDashboardDateInput(previousMonthEnd),
    }
  }

  if (period === 'currentYear') {
    return {
      startDate: formatDashboardDateInput(currentYearStart),
      endDate: formatDashboardDateInput(currentYearEnd),
    }
  }

  if (period === 'fiscalYear') {
    return {
      startDate: formatDashboardDateInput(fiscalYearStart),
      endDate: formatDashboardDateInput(fiscalYearEnd),
    }
  }

  if (period === 'last7') {
    return {
      startDate: formatDashboardDateInput(last7Start),
      endDate: formatDashboardDateInput(today),
    }
  }

  if (period === 'last15') {
    return {
      startDate: formatDashboardDateInput(last15Start),
      endDate: formatDashboardDateInput(today),
    }
  }

  if (period === 'last30') {
    return {
      startDate: formatDashboardDateInput(last30Start),
      endDate: formatDashboardDateInput(today),
    }
  }

  if (period === 'custom') {
    return {
      startDate: customStartDate || formatDashboardDateInput(monthStart),
      endDate: customEndDate || formatDashboardDateInput(monthEnd),
    }
  }

  return {
    startDate: formatDashboardDateInput(monthStart),
    endDate: formatDashboardDateInput(monthEnd),
  }
}

export function formatDashboardDateDisplay(
  value: string | Date | null | undefined,
  formatter: Intl.DateTimeFormat,
) {
  if (!value) {
    return '-'
  }

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }

  return formatter.format(date)
}

export function formatDashboardDateInput(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const ptShortDayFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
})

const ptShortMonthFormatter = new Intl.DateTimeFormat('pt-BR', {
  month: 'short',
  year: '2-digit',
})

export function formatCashflowBucketLabel(
  bucket: string,
  granularity: CashflowGranularity,
) {
  const date = new Date(`${bucket}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return bucket

  if (granularity === 'month') {
    return ptShortMonthFormatter.format(date).replace('.', '')
  }
  return ptShortDayFormatter.format(date).replace('.', '')
}
