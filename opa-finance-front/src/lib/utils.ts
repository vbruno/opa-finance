import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

import { evaluateArithmeticExpression } from './expression'

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
