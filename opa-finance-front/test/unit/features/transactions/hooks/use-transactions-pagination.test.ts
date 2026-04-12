import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useTransactionsPagination } from '@/features/transactions'

describe('useTransactionsPagination', () => {
  it('deve alterar limite e resetar para página 1', () => {
    const navigate = vi.fn()
    const setLimitPreference = vi.fn()
    const { result } = renderHook(() =>
      useTransactionsPagination({
        page: 3,
        totalPages: 10,
        navigate,
        setLimitPreference,
      }),
    )

    act(() => {
      result.current.handleLimitChange('50')
    })

    expect(setLimitPreference).toHaveBeenCalledWith(50)
    expect(navigate).toHaveBeenCalledTimes(1)
    const arg = navigate.mock.calls[0][0]
    expect(arg.search({ page: 3, limit: 30 })).toMatchObject({
      limit: 50,
      page: 1,
    })
  })

  it('deve navegar para página anterior e próxima respeitando limites', () => {
    const navigate = vi.fn()
    const { result } = renderHook(() =>
      useTransactionsPagination({
        page: 1,
        totalPages: 4,
        navigate,
        setLimitPreference: vi.fn(),
      }),
    )

    act(() => {
      result.current.goToPreviousPage()
      result.current.goToNextPage()
      result.current.goToPage(3)
    })

    expect(navigate).toHaveBeenCalledTimes(3)
    const prev = navigate.mock.calls[0][0].search({ page: 1 })
    const next = navigate.mock.calls[1][0].search({ page: 1 })
    const page3 = navigate.mock.calls[2][0].search({ page: 1 })

    expect(prev.page).toBe(1)
    expect(next.page).toBe(2)
    expect(page3.page).toBe(3)
  })
})
