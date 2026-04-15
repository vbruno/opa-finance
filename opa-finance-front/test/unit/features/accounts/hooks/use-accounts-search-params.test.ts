import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useAccountsSearchParams } from '@/features/accounts/hooks/use-accounts-search-params'
import type { AccountsSearchParams } from '@/features/accounts/model/accounts.types'

describe('useAccountsSearchParams', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('sincroniza busca com debounce na URL', () => {
    vi.useFakeTimers()
    const navigate = vi.fn()
    const search: AccountsSearchParams = { q: 'conta' }

    const { result } = renderHook(() =>
      useAccountsSearchParams({ search, navigate }),
    )

    act(() => {
      result.current.setSearchDraft('conta nova')
    })
    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        replace: true,
      }),
    )
  })

  it('aplica filtro de tipo e limpar filtros', () => {
    const navigate = vi.fn()
    const search: AccountsSearchParams = { q: 'x', type: 'cash' }
    const { result } = renderHook(() =>
      useAccountsSearchParams({ search, navigate }),
    )

    act(() => {
      result.current.handleTypeFilterChange('investment')
    })
    act(() => {
      result.current.handleClearFilters()
    })

    expect(navigate).toHaveBeenCalledTimes(2)
  })
})
