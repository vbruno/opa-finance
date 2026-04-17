import { describe, expect, it } from 'vitest'

import {
  calculateMonthlyVariationPercents,
  formatBalanceCell,
  formatVariationPercent,
  parseAccountIdsParam,
  resolveSubcategoryDisplayName,
  sanitizeAccountIds,
} from '@/features/consolidated/model/consolidated.helpers'

describe('consolidated.helpers', () => {
  it('parseAccountIdsParam deve normalizar ids da query string', () => {
    expect(parseAccountIdsParam(undefined)).toBeNull()
    expect(parseAccountIdsParam('')).toBeNull()
    expect(parseAccountIdsParam('a, b , ,c')).toEqual(['a', 'b', 'c'])
  })

  it('sanitizeAccountIds deve remover ids invalidos e respeitar ordem da conta', () => {
    expect(sanitizeAccountIds(null, ['a', 'b'])).toBeNull()
    expect(sanitizeAccountIds(['x'], ['a', 'b'])).toBeNull()
    expect(sanitizeAccountIds(['b', 'a'], ['a', 'b', 'c'])).toEqual(['a', 'b'])
  })

  it('resolveSubcategoryDisplayName deve aplicar fallback para sem subcategoria', () => {
    expect(resolveSubcategoryDisplayName('Habitação', 'Sem subcategoria')).toBe('Habitação *')
    expect(resolveSubcategoryDisplayName('Habitação', 'Mercado')).toBe('Mercado')
  })

  it('formatBalanceCell deve retornar traço para zero e valor formatado para não-zero', () => {
    expect(formatBalanceCell(0)).toBe('-')
    expect(formatBalanceCell(10)).toContain('$')
  })

  it('calculateMonthlyVariationPercents e formatVariationPercent devem respeitar regra de traço', () => {
    const variation = calculateMonthlyVariationPercents([100, 120, 0, 0])
    expect(variation[0]).toBeNull()
    expect(variation[1]).toBe(20)
    expect(formatVariationPercent(0)).toBe('-')
    expect(formatVariationPercent(null)).toBe('-')
  })
})
