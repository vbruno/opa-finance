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
    const minValue = parseNumberInput(parts[0])
    const maxValue = parseNumberInput(parts[1])
    if (minValue === null || maxValue === null) {
      return null
    }
    const min = Math.min(minValue, maxValue)
    const max = Math.max(minValue, maxValue)
    return { amountMin: min, amountMax: max }
  }

  const comparatorMatch = trimmed.match(/^(>=|<=|>|<)\s*(.+)$/)
  if (comparatorMatch) {
    const amountValue = parseNumberInput(comparatorMatch[2])
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

  const exactValue = parseNumberInput(trimmed)
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

function evaluateArithmeticExpression(value: string): number | null {
  const tokens = tokenizeExpression(value)
  if (!tokens || tokens.length === 0) {
    return null
  }
  return evaluateTokens(tokens)
}

function tokenizeExpression(
  value: string,
): Array<number | '+' | '-' | '*' | '/'> | null {
  const input = value.trim()
  if (!input) {
    return null
  }

  const tokens: Array<number | '+' | '-' | '*' | '/'> = []
  let index = 0
  let expectingNumber = true

  while (index < input.length) {
    const char = input[index]
    if (char === ' ' || char === '\t') {
      index += 1
      continue
    }

    if (expectingNumber) {
      const match = input.slice(index).match(/^[+-]?[0-9.,]+/)
      if (!match) {
        return null
      }
      const parsedNumber = parseNumberInput(match[0])
      if (parsedNumber === null) {
        return null
      }
      tokens.push(parsedNumber)
      index += match[0].length
      expectingNumber = false
      continue
    }

    if (char === '+' || char === '-' || char === '*' || char === '/') {
      tokens.push(char)
      index += 1
      expectingNumber = true
      continue
    }

    return null
  }

  if (expectingNumber) {
    return null
  }

  return tokens
}

function evaluateTokens(tokens: Array<number | '+' | '-' | '*' | '/'>): number | null {
  if (tokens.length % 2 === 0) {
    return null
  }
  if (typeof tokens[0] !== 'number') {
    return null
  }

  const values: number[] = [tokens[0]]
  const operations: Array<'+' | '-'> = []

  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i]
    const next = tokens[i + 1]
    if (typeof op !== 'string' || typeof next !== 'number') {
      return null
    }
    if (op === '*' || op === '/') {
      const current = values[values.length - 1]
      if (op === '/' && next === 0) {
        return null
      }
      values[values.length - 1] = op === '*' ? current * next : current / next
    } else {
      operations.push(op)
      values.push(next)
    }
  }

  let result = values[0]
  for (let i = 0; i < operations.length; i += 1) {
    const next = values[i + 1]
    result = operations[i] === '+' ? result + next : result - next
  }

  if (!Number.isFinite(result)) {
    return null
  }
  return result
}

function parseNumberInput(value: string): number | null {
  const cleaned = value.replace(/\s+/g, '')
  if (!cleaned) {
    return null
  }
  if (!/^[+-]?[0-9.,]+$/.test(cleaned)) {
    return null
  }
  const sign = cleaned.startsWith('-') ? -1 : 1
  const unsigned = cleaned.replace(/^[-+]/, '')
  if (!/[0-9]/.test(unsigned)) {
    return null
  }
  const lastDot = unsigned.lastIndexOf('.')
  const lastComma = unsigned.lastIndexOf(',')
  const decimalIndex = Math.max(lastDot, lastComma)
  let integerPart = unsigned
  let fractionalPart = ''
  if (decimalIndex >= 0) {
    integerPart = unsigned.slice(0, decimalIndex)
    fractionalPart = unsigned.slice(decimalIndex + 1)
  }
  const integerDigits = integerPart.replace(/[.,]/g, '') || '0'
  const fractionalDigits = fractionalPart.replace(/[.,]/g, '')
  const normalized = fractionalDigits
    ? `${integerDigits}.${fractionalDigits}`
    : integerDigits
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) {
    return null
  }
  return sign * parsed
}
