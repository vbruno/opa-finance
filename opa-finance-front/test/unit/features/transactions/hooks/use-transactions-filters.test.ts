import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useTransactionsFilters } from '@/features/transactions'

describe('useTransactionsFilters', () => {
  it('não deve sincronizar quando ainda não carregou dados da página', () => {
    const navigate = vi.fn()

    renderHook(() =>
      useTransactionsFilters({
        search: {
          page: 3,
          limit: 30,
          sort: 'date',
          dir: 'desc',
        },
        navigate,
        page: 3,
        limit: 30,
        sortKey: 'date',
        sortDirection: 'desc',
        totalPages: 5,
        hasLoadedPageData: false,
      }),
    )

    expect(navigate).not.toHaveBeenCalled()
  })

  it('deve sincronizar pagina/sort/dir quando search está divergente', () => {
    const navigate = vi.fn()

    renderHook(() =>
      useTransactionsFilters({
        search: {
          page: 5,
          limit: 20,
          sort: 'amount',
          dir: 'asc',
        },
        navigate,
        page: 10,
        limit: 30,
        sortKey: null,
        sortDirection: 'asc',
        totalPages: 4,
        hasLoadedPageData: true,
      }),
    )

    expect(navigate).toHaveBeenCalledTimes(1)
    const arg = navigate.mock.calls[0][0]
    expect(arg.replace).toBe(true)

    const nextSearch = arg.search({
      page: 5,
      limit: 20,
      sort: 'amount',
      dir: 'asc',
    })
    expect(nextSearch).toMatchObject({
      page: 4,
      limit: 30,
      sort: 'date',
      dir: 'desc',
    })
  })

  it('não deve sincronizar quando search já está canônico', () => {
    const navigate = vi.fn()

    renderHook(() =>
      useTransactionsFilters({
        search: {
          page: 2,
          limit: 30,
          sort: 'date',
          dir: 'desc',
        },
        navigate,
        page: 2,
        limit: 30,
        sortKey: null,
        sortDirection: 'asc',
        totalPages: 5,
        hasLoadedPageData: true,
      }),
    )

    expect(navigate).not.toHaveBeenCalled()
  })
})
