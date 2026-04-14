import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useDashboardSearchParams } from '@/features/dashboard/hooks/use-dashboard-search-params'

describe('useDashboardSearchParams', () => {
  it('deve definir conta padrao quando accountId nao vier na URL', () => {
    const navigate = vi.fn()

    renderHook(() =>
      useDashboardSearchParams({
        search: { period: 'month' },
        navigate,
        dashboardAccounts: [
          { id: 'a-1', isPrimary: true },
          { id: 'a-2', isPrimary: false },
        ],
        accountsLoaded: true,
      }),
    )

    expect(navigate).toHaveBeenCalled()
    const searchFn = navigate.mock.calls[0][0].search
    expect(searchFn({ period: 'month' })).toMatchObject({ accountId: 'a-1' })
  })

  it('deve limpar datas ao trocar para periodo preset', () => {
    const navigate = vi.fn()

    const { result } = renderHook(() =>
      useDashboardSearchParams({
        search: {
          period: 'custom',
          startDate: '2026-01-01',
          endDate: '2026-01-31',
          accountId: 'a-1',
        },
        navigate,
        dashboardAccounts: [{ id: 'a-1', isPrimary: true }],
        accountsLoaded: true,
      }),
    )

    act(() => {
      result.current.handlePeriodChange('last7')
    })

    const searchFn = navigate.mock.calls.at(-1)?.[0].search
    expect(
      searchFn({
        period: 'custom',
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        accountId: 'a-1',
      }),
    ).toMatchObject({
      period: 'last7',
      startDate: undefined,
      endDate: undefined,
    })
  })

  it('deve corrigir accountId invalido para conta primaria', () => {
    const navigate = vi.fn()

    renderHook(() =>
      useDashboardSearchParams({
        search: { period: 'month', accountId: 'invalida' },
        navigate,
        dashboardAccounts: [{ id: 'a-1', isPrimary: true }],
        accountsLoaded: true,
      }),
    )

    const correctionCall = navigate.mock.calls.find(
      (call) => call[0].replace === true,
    )
    expect(correctionCall).toBeDefined()
    expect(correctionCall?.[0].search({ accountId: 'invalida' })).toMatchObject({
      accountId: 'a-1',
    })
  })
})
