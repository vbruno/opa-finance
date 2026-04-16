import { describe, expect, it } from 'vitest'

import {
  CATEGORY_TYPE_LABELS,
  CATEGORY_TYPE_OPTIONS,
  CATEGORY_TYPE_VALUES,
  isCategoryType,
} from '@/features/categories/model/categories.constants'

describe('categories.constants', () => {
  it('expõe tipos suportados e labels', () => {
    expect(CATEGORY_TYPE_VALUES).toEqual(['income', 'expense'])
    expect(CATEGORY_TYPE_LABELS.income).toBe('Receita')
    expect(CATEGORY_TYPE_LABELS.expense).toBe('Despesa')
  })

  it('gera opções de select', () => {
    expect(CATEGORY_TYPE_OPTIONS).toEqual([
      { value: 'income', label: 'Receita' },
      { value: 'expense', label: 'Despesa' },
    ])
  })

  it('valida tipo de categoria', () => {
    expect(isCategoryType('income')).toBe(true)
    expect(isCategoryType('expense')).toBe(true)
    expect(isCategoryType('other')).toBe(false)
  })
})
