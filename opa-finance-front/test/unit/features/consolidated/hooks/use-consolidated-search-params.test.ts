import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useConsolidatedSearchParams } from '@/features/consolidated/hooks/use-consolidated-search-params'

describe('useConsolidatedSearchParams', () => {
  it('deve usar currentYear quando year não vier na URL', () => {
    const navigate = vi.fn()

    const { result } = renderHook(() =>
      useConsolidatedSearchParams({
        search: {},
        navigate,
        accounts: [{ id: 'acc-1', name: 'A', isPrimary: true } as never],
        currentYear: 2026,
      }),
    )

    expect(result.current.year).toBe(2026)
    expect(result.current.effectiveAccountIds).toEqual(['acc-1'])
  })

  it('toggleAccount deve atualizar accountIds no search preservando ordem do catálogo', () => {
    const navigate = vi.fn()
    const { result } = renderHook(() =>
      useConsolidatedSearchParams({
        search: { accountIds: 'acc-1' },
        navigate,
        accounts: [
          { id: 'acc-1', name: 'A', isPrimary: true },
          { id: 'acc-2', name: 'B', isPrimary: false },
        ] as never,
        currentYear: 2026,
      }),
    )

    act(() => {
      result.current.toggleAccount('acc-2')
    })

    const searchFn = navigate.mock.calls.at(-1)?.[0].search
    expect(searchFn({ accountIds: 'acc-1' })).toMatchObject({
      accountIds: 'acc-1,acc-2',
    })
  })
})
