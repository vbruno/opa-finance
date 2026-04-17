import type { WeeklyCashflowColumn } from '@/features/reports'
import { formatCurrencyValue } from '@/lib/utils'

import { VIEW_ID, VIEW_STATE_VERSION } from './weekly-cashflow.constants'
import type {
  GroupDisplayMode,
  WeeklyCashflowGroup,
  WeeklyCashflowViewState,
} from './weekly-cashflow.types'

export function formatDynamicColumnLabel(column: WeeklyCashflowColumn) {
  const rawLabel =
    column.label.trim() ||
    column.subcategoryName?.trim() ||
    column.categoryName.trim() ||
    'Sem titulo'

  if (column.scope === 'subcategory') {
    const categoryName = column.categoryName.trim()
    if (categoryName) {
      return `[ ${categoryName.toUpperCase()} ]\n${rawLabel}`
    }
  }

  return rawLabel
}

export function loadWeeklyCashflowViewState(
  key: string,
): WeeklyCashflowViewState | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as WeeklyCashflowViewState
    if (parsed?.version !== VIEW_STATE_VERSION || parsed?.viewId !== VIEW_ID) {
      return null
    }
    if (
      !parsed.groupDisplayModes &&
      Array.isArray((parsed as { expandedGroupIds?: unknown }).expandedGroupIds)
    ) {
      const expanded = (parsed as { expandedGroupIds?: string[] }).expandedGroupIds ?? []
      parsed.groupDisplayModes = Object.fromEntries(
        expanded.map((groupId) => [groupId, 'both' as GroupDisplayMode]),
      )
    }
    return parsed
  } catch {
    return null
  }
}

export function saveWeeklyCashflowViewState(key: string, state: WeeklyCashflowViewState) {
  try {
    localStorage.setItem(key, JSON.stringify(state))
  } catch {
    // no-op
  }
}

export function formatWeeklyValue(value: number) {
  if (!Number.isFinite(value) || value === 0) {
    return '-'
  }
  return `$ ${formatCurrencyValue(value)}`
}

export function formatWeeklyValueWithShare(
  value: number,
  valueType: 'income' | 'expense' | null,
  week: { received: number; spent: number },
) {
  const formattedValue = formatWeeklyValue(value)
  if (formattedValue === '-' || !valueType) {
    return formattedValue
  }

  const base = valueType === 'income' ? week.received : week.spent
  if (!Number.isFinite(base) || Math.abs(base) < 0.00001) {
    return formattedValue
  }

  const percentage = Math.round((Math.abs(value) / Math.abs(base)) * 100)
  return `${formattedValue} (${percentage}%)`
}

export function formatAverageValueWithShare(
  value: number,
  valueType: 'income' | 'expense' | null,
  sharePercentage: number,
) {
  const formattedValue = formatWeeklyValue(value)
  if (formattedValue === '-' || !valueType) {
    return formattedValue
  }
  if (!Number.isFinite(sharePercentage) || Math.abs(sharePercentage) < 0.00001) {
    return formattedValue
  }

  const percentage = Math.round(sharePercentage)
  return `${formattedValue} (${percentage}%)`
}

export function formatShortDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) {
    return value
  }
  return `${match[3]}-${match[2]}`
}

export function getLocalIsoDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isIsoDateInRange(targetIso: string, startIso: string, endIso: string) {
  return targetIso >= startIso && targetIso <= endIso
}

export function parseIsoDateToUtc(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) {
    return null
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null
  }
  return new Date(Date.UTC(year, month - 1, day))
}

export function getUtcMonthRange(year: number, monthIndex: number) {
  const start = new Date(Date.UTC(year, monthIndex, 1))
  const end = new Date(Date.UTC(year, monthIndex + 1, 0))
  return { start, end }
}

export function maxUtcDate(left: Date, right: Date) {
  return left.getTime() >= right.getTime() ? left : right
}

export function minUtcDate(left: Date, right: Date) {
  return left.getTime() <= right.getTime() ? left : right
}

export function getOverlapDaysInclusive(
  leftStart: Date,
  leftEnd: Date,
  rightStart: Date,
  rightEnd: Date,
) {
  const start = maxUtcDate(leftStart, rightStart)
  const end = minUtcDate(leftEnd, rightEnd)
  if (start.getTime() > end.getTime()) {
    return 0
  }
  const DAY_MS = 24 * 60 * 60 * 1000
  return Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1
}

export function normalizeSeparatorPositions(
  separatorPositions?: number[],
  legacySeparatorPosition?: number | null,
) {
  if (Array.isArray(separatorPositions)) {
    return Array.from(new Set(separatorPositions)).sort((a, b) => a - b)
  }
  if (typeof legacySeparatorPosition === 'number') {
    return [legacySeparatorPosition]
  }
  return []
}

export function areArraysEqual<T>(a: T[], b: T[]) {
  if (a.length !== b.length) {
    return false
  }
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) {
      return false
    }
  }
  return true
}

export function areGroupsEqual(a: WeeklyCashflowGroup[], b: WeeklyCashflowGroup[]) {
  if (a.length !== b.length) {
    return false
  }
  for (let index = 0; index < a.length; index += 1) {
    const left = a[index]
    const right = b[index]
    if (!left || !right) {
      return false
    }
    if (left.id !== right.id || left.name !== right.name) {
      return false
    }
    if (!areArraysEqual(left.columnIds, right.columnIds)) {
      return false
    }
  }
  return true
}

export function areGroupDisplayModesEqual(
  a: Record<string, GroupDisplayMode>,
  b: Record<string, GroupDisplayMode>,
) {
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) {
    return false
  }
  for (const key of aKeys) {
    if (a[key] !== b[key]) {
      return false
    }
  }
  return true
}

export function isGroupDisplayMode(value: unknown): value is GroupDisplayMode {
  return value === 'group' || value === 'children' || value === 'both'
}
