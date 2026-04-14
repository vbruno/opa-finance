import { describe, expect, it, vi } from 'vitest'

import {
  formatDashboardDateDisplay,
  formatDashboardDateInput,
  getDashboardDateRange,
} from '@/features/dashboard/model/dashboard.helpers'

describe('dashboard.helpers', () => {
  describe('formatDashboardDateInput', () => {
    it('deve formatar Date em yyyy-mm-dd', () => {
      const date = new Date('2026-04-14T12:00:00Z')
      expect(formatDashboardDateInput(date)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })

  describe('formatDashboardDateDisplay', () => {
    const formatter = new Intl.DateTimeFormat('pt-BR')

    it('deve formatar data valida', () => {
      expect(formatDashboardDateDisplay('2026-04-14', formatter)).toBe(
        '14/04/2026',
      )
    })

    it('deve retornar - para valor vazio ou invalido', () => {
      expect(formatDashboardDateDisplay(undefined, formatter)).toBe('-')
      expect(formatDashboardDateDisplay('invalida', formatter)).toBe('-')
    })
  })

  describe('getDashboardDateRange', () => {
    it('deve usar datas custom quando periodo custom', () => {
      expect(
        getDashboardDateRange('custom', '2026-01-10', '2026-01-20'),
      ).toEqual({
        startDate: '2026-01-10',
        endDate: '2026-01-20',
      })
    })

    it('deve usar fallback para custom vazio com mes atual', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-04-14T10:00:00Z'))
      try {
        expect(getDashboardDateRange('custom', '', '')).toEqual({
          startDate: '2026-04-01',
          endDate: '2026-04-30',
        })
      } finally {
        vi.useRealTimers()
      }
    })
  })
})
