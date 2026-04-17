import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useRecurrencesSearchParams } from '@/features/recurrences/hooks/use-recurrences-search-params'

describe('useRecurrencesSearchParams', () => {
  it('deve aplicar defaults de paginação', () => {
    const { result } = renderHook(() =>
      useRecurrencesSearchParams({
        search: {},
        navigate: vi.fn(),
      }),
    )

    expect(result.current.page).toBe(1)
    expect(result.current.limit).toBe(20)
  })

  it('setSearch deve delegar atualização para navigate', () => {
    const navigate = vi.fn()
    const { result } = renderHook(() =>
      useRecurrencesSearchParams({
        search: { page: 2, limit: 50, status: 'active' },
        navigate,
      }),
    )

    result.current.setSearch({ page: 1, q: 'academia' })
    expect(navigate).toHaveBeenCalledTimes(1)
  })
})
