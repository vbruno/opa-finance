import { formatCurrencyValue } from '@/lib/utils'

import type { ConsolidatedSectionTone } from './consolidated.types'

export function parseAccountIdsParam(value?: string) {
  if (!value) {
    return null
  }
  const ids = value
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
  return ids.length ? ids : null
}

export function sanitizeAccountIds(
  selectedAccountIds: string[] | null,
  allAccountIds: string[],
) {
  if (!selectedAccountIds) {
    return null
  }
  if (!allAccountIds.length) {
    return selectedAccountIds
  }
  const validIds = new Set(allAccountIds)
  const filtered = selectedAccountIds.filter((id) => validIds.has(id))
  if (!filtered.length) {
    return null
  }
  return allAccountIds.filter((id) => filtered.includes(id))
}

export function resolveSubcategoryDisplayName(
  categoryName: string,
  subcategoryName: string,
) {
  const normalized = subcategoryName.trim().toLowerCase()
  if (normalized === 'sem subcategoria' || normalized === 'sem categoria') {
    return `${categoryName} *`
  }

  return subcategoryName
}

export function formatBalanceCell(value: number) {
  if (!Number.isFinite(value) || value === 0) {
    return '-'
  }
  return `$ ${formatCurrencyValue(value)}`
}

export function getBalanceCellAlignmentClass(value: number) {
  return value === 0 || !Number.isFinite(value) ? 'text-center' : 'text-right'
}

export function getMonthlyBalanceToneClass(value: number) {
  if (!Number.isFinite(value) || value === 0) {
    return 'text-muted-foreground'
  }
  return value > 0 ? 'text-emerald-500 font-semibold' : 'text-rose-500 font-semibold'
}

export function getMonthlyBalanceVariationToneClass(value: number | null) {
  if (value === null || !Number.isFinite(value) || value === 0) {
    return 'text-muted-foreground'
  }
  return value > 0 ? 'text-emerald-400' : 'text-rose-400'
}

export function formatBalanceDelta(value: number | null) {
  if (value === null || !Number.isFinite(value) || value === 0) {
    return '-'
  }
  return `${value > 0 ? '+' : '-'}$ ${formatCurrencyValue(Math.abs(value))}`
}

export function calculateMonthlyVariationPercents(months: number[]) {
  return months.map((currentValue, index) => {
    if (index === 0) {
      return null
    }

    const previousValue = months[index - 1]
    if (!Number.isFinite(previousValue) || !Number.isFinite(currentValue)) {
      return null
    }

    if (previousValue === 0) {
      return currentValue === 0 ? 0 : null
    }

    return ((currentValue - previousValue) / Math.abs(previousValue)) * 100
  })
}

export function formatVariationPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return '-'
  }

  if (value === 0) {
    return '-'
  }

  const formatted = Math.abs(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })

  return `${value > 0 ? '+' : '-'}${formatted}%`
}

export function getVariationToneClass(
  sectionTone: ConsolidatedSectionTone,
  value: number | null,
) {
  if (value === null || !Number.isFinite(value) || value === 0) {
    return 'text-muted-foreground'
  }

  if (sectionTone === 'income') {
    return value > 0 ? 'text-emerald-400' : 'text-rose-400'
  }

  return value > 0 ? 'text-rose-400' : 'text-emerald-400'
}

export function getForecastToneClass(
  tone: ConsolidatedSectionTone | 'balance',
  value: number,
) {
  if (tone === 'income') return 'text-emerald-600'
  if (tone === 'expense') return 'text-rose-600'
  if (value > 0) return 'text-emerald-600'
  if (value < 0) return 'text-rose-600'
  return 'text-muted-foreground'
}
