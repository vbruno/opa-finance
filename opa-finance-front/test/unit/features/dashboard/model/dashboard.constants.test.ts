import { describe, expect, it } from 'vitest'

import {
  DASHBOARD_PERIOD_OPTIONS,
  DASHBOARD_PERIOD_VALUES,
  DASHBOARD_PRESET_PERIOD_VALUES,
  isDashboardPeriod,
  isDashboardPresetPeriod,
} from '@/features/dashboard/model/dashboard.constants'

describe('dashboard.constants', () => {
  it('deve manter lista canonica de periodos e opcoes em sincronia', () => {
    expect(DASHBOARD_PERIOD_VALUES).toEqual([
      'month',
      'currentYear',
      'fiscalYear',
      'previousMonth',
      'last7',
      'last15',
      'last30',
      'custom',
    ])

    expect(DASHBOARD_PERIOD_OPTIONS.map((option) => option.value)).toEqual(
      ['month', 'previousMonth', 'currentYear', 'fiscalYear', 'custom'],
    )
  })

  it('deve validar guard de periodo completo', () => {
    expect(isDashboardPeriod('month')).toBe(true)
    expect(isDashboardPeriod('custom')).toBe(true)
    expect(isDashboardPeriod('invalid')).toBe(false)
  })

  it('deve validar guard de periodos preset (sem custom)', () => {
    for (const value of DASHBOARD_PRESET_PERIOD_VALUES) {
      expect(isDashboardPresetPeriod(value)).toBe(true)
    }

    expect(isDashboardPresetPeriod('custom')).toBe(false)
  })
})
