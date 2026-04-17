import { describe, expect, it } from 'vitest'

import {
  buildMonthlyBalance,
  buildMonthlyBalanceDelta,
  buildSectionMonthlyVariation,
} from '@/features/consolidated/mappers/consolidated-balance.mapper'

describe('consolidated-balance.mapper', () => {
  it('buildMonthlyBalance deve calcular receita - despesa por mês', () => {
    expect(buildMonthlyBalance([100, 80], [40, 90])).toEqual([60, -10])
  })

  it('buildMonthlyBalanceDelta deve calcular diferenca contra mês anterior', () => {
    expect(buildMonthlyBalanceDelta([60, -10, 20])).toEqual([null, -70, 30])
  })

  it('buildSectionMonthlyVariation deve delegar variação mensal', () => {
    expect(buildSectionMonthlyVariation([100, 150])[1]).toBe(50)
  })
})
