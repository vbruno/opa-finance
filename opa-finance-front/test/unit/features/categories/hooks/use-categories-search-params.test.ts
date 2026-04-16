import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useCategoriesSearchParams } from '@/features/categories/hooks/use-categories-search-params'

describe('useCategoriesSearchParams', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('calcula estado de filtros e normalizações', () => {
    const navigate = vi.fn()
    const { result } = renderHook(() =>
      useCategoriesSearchParams({
        search: { q: '  Mercado ', type: 'expense' },
        navigate,
      }),
    )

    expect(result.current.searchTerm).toBe('  Mercado ')
    expect(result.current.typeFilter).toBe('expense')
    expect(result.current.hasActiveFilters).toBe(true)
    expect(result.current.normalizedSearch).toBe('mercado')
  })

  it('aplica debounce da busca e navega ao alterar valor', () => {
    vi.useFakeTimers()
    const navigate = vi.fn()
    const { result } = renderHook(() =>
      useCategoriesSearchParams({
        search: { q: 'abc' },
        navigate,
      }),
    )

    act(() => {
      result.current.setSearchValue('novo valor', true)
      vi.advanceTimersByTime(300)
    })

    expect(navigate).toHaveBeenCalled()
  })

  it('altera tipo e limpa filtros', () => {
    const navigate = vi.fn()
    const { result } = renderHook(() =>
      useCategoriesSearchParams({
        search: { q: 'x', type: 'income' },
        navigate,
      }),
    )

    act(() => {
      result.current.setTypeValue('expense')
      result.current.clearFilters()
    })

    expect(navigate).toHaveBeenCalledTimes(2)
  })
})
