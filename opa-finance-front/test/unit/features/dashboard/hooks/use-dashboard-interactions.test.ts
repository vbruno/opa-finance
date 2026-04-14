import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useDashboardInteractions } from '@/features/dashboard/hooks/use-dashboard-interactions'

describe('useDashboardInteractions', () => {
  it('deve fechar transacao selecionada ao pressionar Escape', () => {
    const clearSelectedTopCategory = vi.fn()
    const { result } = renderHook(() =>
      useDashboardInteractions({
        hasSelectedTopCategory: false,
        clearSelectedTopCategory,
      }),
    )

    act(() => {
      result.current.setSelectedTransaction({
        id: 'tx-1',
        userId: 'u-1',
        accountId: 'a-1',
        categoryId: 'c-1',
        subcategoryId: null,
        type: 'expense',
        amount: 100,
        date: '2026-04-14',
        description: 'Teste',
        notes: null,
        transferId: null,
        createdAt: '2026-04-14T00:00:00.000Z',
      })
    })

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })

    expect(result.current.selectedTransaction).toBeNull()
    expect(clearSelectedTopCategory).not.toHaveBeenCalled()
  })

  it('deve limpar categoria selecionada quando nao ha transacao no Escape', () => {
    const clearSelectedTopCategory = vi.fn()
    renderHook(() =>
      useDashboardInteractions({
        hasSelectedTopCategory: true,
        clearSelectedTopCategory,
      }),
    )

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })

    expect(clearSelectedTopCategory).toHaveBeenCalledTimes(1)
  })
})
