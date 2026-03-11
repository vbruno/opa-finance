import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrencyValue(value: number) {
  return currencyFormatter.format(value)
}

export function parseCurrencyInput(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  if (trimmed.startsWith('=')) {
    const expressionValue = evaluateArithmeticExpression(trimmed.slice(1))
    if (
      expressionValue === null ||
      Number.isNaN(expressionValue) ||
      !Number.isFinite(expressionValue)
    ) {
      return null
    }
    return expressionValue
  }

  const normalized = value.replace(/[^\d]/g, '')
  if (!normalized) {
    return null
  }
  return Number(normalized) / 100
}

export function formatCurrencyInput(value: string) {
  if (value.trimStart().startsWith('=')) {
    return value
  }
  const amount = parseCurrencyInput(value)
  if (amount === null || Number.isNaN(amount)) {
    return ''
  }
  return `$ ${formatCurrencyValue(amount)}`
}

export function sanitizeExpressionInput(value: string) {
  const trimmedStart = value.trimStart()
  if (!trimmedStart.startsWith('=')) {
    return value
  }

  const expressionBody = trimmedStart.slice(1)
  const sanitizedBody = expressionBody.replace(/[^0-9+\-*/().,\s]/g, '')
  return `=${sanitizedBody}`
}

function evaluateArithmeticExpression(value: string): number | null {
  const tokens = tokenizeExpression(value)
  if (!tokens || tokens.length === 0) {
    return null
  }
  const result = parseExpressionTokens(tokens)
  if (result === null || Number.isNaN(result) || !Number.isFinite(result)) {
    return null
  }
  return result
}

type ExpressionToken = number | '+' | '-' | '*' | '/' | '(' | ')'

function tokenizeExpression(value: string): ExpressionToken[] | null {
  const input = value.trim()
  if (!input) {
    return null
  }

  const tokens: ExpressionToken[] = []
  let index = 0

  while (index < input.length) {
    const char = input[index]
    if (char === ' ' || char === '\t') {
      index += 1
      continue
    }

    if (char === '+' || char === '-' || char === '*' || char === '/') {
      tokens.push(char)
      index += 1
      continue
    }

    if (char === '(' || char === ')') {
      tokens.push(char)
      index += 1
      continue
    }

    if ((char >= '0' && char <= '9') || char === '.' || char === ',') {
      const match = input.slice(index).match(/^[0-9.,]+/)
      if (!match) {
        return null
      }
      const parsedNumber = parseExpressionNumber(match[0])
      if (parsedNumber === null) {
        return null
      }
      tokens.push(parsedNumber)
      index += match[0].length
      continue
    }

    return null
  }

  return tokens
}

function parseExpressionTokens(tokens: ExpressionToken[]): number | null {
  let index = 0

  const parseExpression = (): number | null => {
    let value = parseTerm()
    if (value === null) {
      return null
    }

    while (index < tokens.length) {
      const token = tokens[index]
      if (token !== '+' && token !== '-') {
        break
      }
      index += 1
      const right = parseTerm()
      if (right === null) {
        return null
      }
      value = token === '+' ? value + right : value - right
    }
    return value
  }

  const parseTerm = (): number | null => {
    let value = parseFactor()
    if (value === null) {
      return null
    }

    while (index < tokens.length) {
      const token = tokens[index]
      if (token !== '*' && token !== '/') {
        break
      }
      index += 1
      const right = parseFactor()
      if (right === null) {
        return null
      }
      if (token === '/' && right === 0) {
        return null
      }
      value = token === '*' ? value * right : value / right
    }
    return value
  }

  const parseFactor = (): number | null => {
    if (index >= tokens.length) {
      return null
    }

    const token = tokens[index]

    if (token === '+' || token === '-') {
      index += 1
      const next = parseFactor()
      if (next === null) {
        return null
      }
      return token === '-' ? -next : next
    }

    if (token === '(') {
      index += 1
      const value = parseExpression()
      if (value === null || tokens[index] !== ')') {
        return null
      }
      index += 1
      return value
    }

    if (typeof token === 'number') {
      index += 1
      return token
    }

    return null
  }

  const result = parseExpression()
  if (result === null || index !== tokens.length) {
    return null
  }
  return result
}

function parseExpressionNumber(value: string): number | null {
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
