import { calculateMonthlyVariationPercents } from '@/features/consolidated/model/consolidated.helpers'

export function buildMonthlyBalance(incomeMonths: number[], expenseMonths: number[]) {
  return incomeMonths.map((income, index) => income - (expenseMonths[index] ?? 0))
}

export function buildMonthlyBalanceDelta(monthlyBalance: number[]) {
  return monthlyBalance.map((currentValue, index) => {
    if (index === 0) {
      return null
    }
    const previousValue = monthlyBalance[index - 1]
    if (!Number.isFinite(previousValue) || !Number.isFinite(currentValue)) {
      return null
    }
    return currentValue - previousValue
  })
}

export function buildSectionMonthlyVariation(months: number[]) {
  return calculateMonthlyVariationPercents(months)
}
