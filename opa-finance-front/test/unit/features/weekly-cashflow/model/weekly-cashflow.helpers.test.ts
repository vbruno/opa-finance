import { describe, expect, it } from 'vitest'

import {
  formatDynamicColumnLabel,
  formatShortDate,
  formatWeeklyValue,
  normalizeSeparatorPositions,
} from '@/features/weekly-cashflow/model/weekly-cashflow.helpers'

describe('weekly-cashflow.helpers', () => {
  it('formata label dinâmica de subcategoria com prefixo da categoria', () => {
    const label = formatDynamicColumnLabel({
      id: 'col-1',
      label: 'Mercado',
      categoryName: 'Habitação',
      subcategoryName: 'Mercado',
      type: 'expense',
      scope: 'subcategory',
    })

    expect(label).toBe('[ HABITAÇÃO ]\nMercado')
  })

  it('normaliza posições de separador removendo duplicatas', () => {
    expect(normalizeSeparatorPositions([3, 1, 3, 2])).toEqual([1, 2, 3])
    expect(normalizeSeparatorPositions(undefined, 4)).toEqual([4])
  })

  it('formata datas curtas e valores semanais', () => {
    expect(formatShortDate('2026-04-16')).toBe('16-04')
    expect(formatWeeklyValue(0)).toBe('-')
    expect(formatWeeklyValue(1234.56)).toContain('$')
  })
})
