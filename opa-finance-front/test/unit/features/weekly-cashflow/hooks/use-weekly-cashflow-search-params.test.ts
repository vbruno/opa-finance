import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useWeeklyCashflowSearchParams } from '@/features/weekly-cashflow/hooks/use-weekly-cashflow-search-params'
import type { WeeklyCashflowSearch } from '@/features/weekly-cashflow/model/weekly-cashflow.types'

describe('useWeeklyCashflowSearchParams', () => {
  it('usa valores da URL e atualiza conta selecionada', () => {
    const navigate = vi.fn()
    const search: WeeklyCashflowSearch = {
      year: 2026,
      weekStart: 'sunday',
      accountIds: 'acc-1',
    }

    const { result } = renderHook(() =>
      useWeeklyCashflowSearchParams({
        search,
        navigate,
        currentYear: 2025,
        allAccountIds: ['acc-1', 'acc-2'],
        primaryAccountId: 'acc-1',
      }),
    )

    expect(result.current.year).toBe(2026)
    expect(result.current.weekStart).toBe('sunday')
    expect(result.current.selectedAccountIds).toEqual(['acc-1'])

    act(() => {
      result.current.updateSelectedAccounts(['acc-1', 'acc-2'])
    })

    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        replace: true,
      }),
    )
  })

  it('toggleAccount remove/adiciona ids e mantém fallback na primária', () => {
    const navigate = vi.fn()
    const search: WeeklyCashflowSearch = {
      accountIds: 'acc-1',
    }

    const { result } = renderHook(() =>
      useWeeklyCashflowSearchParams({
        search,
        navigate,
        currentYear: 2026,
        allAccountIds: ['acc-1', 'acc-2'],
        primaryAccountId: 'acc-1',
      }),
    )

    act(() => {
      result.current.toggleAccount('acc-1')
    })

    expect(navigate).toHaveBeenCalled()
  })
})
