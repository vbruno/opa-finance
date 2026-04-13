import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useTransactionsSearchParams } from '@/features/transactions'

describe('useTransactionsSearchParams', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('deve montar queryParams e aplicar debounce de descrição com navegação', () => {
    vi.useFakeTimers()
    const navigate = vi.fn()

    const { result } = renderHook(() =>
      useTransactionsSearchParams({
        search: { page: 2, limit: 30, description: 'base' },
        navigate,
        limitPreference: 30,
      }),
    )

    expect(result.current.queryParams.page).toBe(2)
    expect(result.current.queryParams.limit).toBe(30)

    act(() => {
      result.current.setDescriptionDraft('novo texto')
      vi.advanceTimersByTime(500)
    })

    expect(navigate).toHaveBeenCalled()
    const callArg = navigate.mock.calls.at(-1)?.[0]
    expect(callArg?.replace).toBe(true)
    expect(callArg?.search({ description: 'base', page: 2 })).toMatchObject({
      description: 'novo texto',
      page: 1,
    })
  })

  it('deve alternar direção de ordenação no handleSort', () => {
    const navigate = vi.fn()
    const { result } = renderHook(() =>
      useTransactionsSearchParams({
        search: { sort: 'date', dir: 'asc' },
        navigate,
        limitPreference: 30,
      }),
    )

    act(() => {
      result.current.handleSort('date')
    })

    const nextSearch = navigate.mock.calls[0][0].search({
      sort: 'date',
      dir: 'asc',
    })
    expect(nextSearch).toMatchObject({ sort: 'date', dir: 'desc' })
  })

  it('deve limpar filtros no handleClearFilters', () => {
    const navigate = vi.fn()
    const { result } = renderHook(() =>
      useTransactionsSearchParams({
        search: {
          page: 3,
          description: 'abc',
          type: 'expense',
          amountMode: true,
          amount: '100',
        },
        navigate,
        limitPreference: 30,
      }),
    )

    act(() => {
      result.current.handleClearFilters()
    })

    const nextSearch = navigate.mock.calls[0][0].search({
      page: 3,
      description: 'abc',
      type: 'expense',
      amountMode: true,
      amount: '100',
    })
    expect(nextSearch).toMatchObject({
      page: 1,
      description: undefined,
      type: undefined,
      amountMode: undefined,
      amount: undefined,
    })
  })
})
