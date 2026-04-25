import { evaluateArithmeticExpression, parseExpressionNumber } from '@/lib/expression'

export type AmountFilterResult = {
  amount?: number
  amountMin?: number
  amountMax?: number
  amountOp?: 'gt' | 'gte' | 'lt' | 'lte'
}

export function parseAmountFilter(value: string): AmountFilterResult | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  if (trimmed.startsWith('=')) {
    const expressionValue = evaluateArithmeticExpression(trimmed.slice(1))
    if (expressionValue === null) {
      return null
    }
    return { amount: expressionValue }
  }

  if (trimmed.includes(';')) {
    const parts = trimmed.split(';')
    if (parts.length !== 2) {
      return null
    }
    const minValue = parseExpressionNumber(parts[0])
    const maxValue = parseExpressionNumber(parts[1])
    if (minValue === null || maxValue === null) {
      return null
    }
    const min = Math.min(minValue, maxValue)
    const max = Math.max(minValue, maxValue)
    return { amountMin: min, amountMax: max }
  }

  const comparatorMatch = trimmed.match(/^(>=|<=|>|<)\s*(.+)$/)
  if (comparatorMatch) {
    const amountValue = parseExpressionNumber(comparatorMatch[2])
    if (amountValue === null) {
      return null
    }
    const opMap: Record<string, 'gt' | 'gte' | 'lt' | 'lte'> = {
      '>': 'gt',
      '>=': 'gte',
      '<': 'lt',
      '<=': 'lte',
    }
    return { amountOp: opMap[comparatorMatch[1]], amount: amountValue }
  }

  const exactValue = parseExpressionNumber(trimmed)
  if (exactValue === null) {
    return null
  }
  return { amount: exactValue }
}

export function buildPaginationItems(current: number, total: number) {
  if (total <= 1) {
    return [1]
  }

  const items: Array<number | '...'> = []
  const add = (value: number | '...') => items.push(value)
  const siblings = 1

  const showLeftEllipsis = current > 2 + siblings
  const showRightEllipsis = current < total - (1 + siblings)

  add(1)

  if (showLeftEllipsis) {
    add('...')
  }

  const start = Math.max(2, current - siblings)
  const end = Math.min(total - 1, current + siblings)

  for (let page = start; page <= end; page += 1) {
    add(page)
  }

  if (showRightEllipsis) {
    add('...')
  }

  if (total > 1) {
    add(total)
  }

  return items
}

export function formatDateDisplay(
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

export function formatDateInput(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isIsoDate(value: string | null | undefined) {
  if (!value) {
    return false
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}
