import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useAuditSearchParams } from '@/features/audit/hooks/use-audit-search-params'

describe('useAuditSearchParams', () => {
  it('deve aplicar defaults de paginação', () => {
    const { result } = renderHook(() =>
      useAuditSearchParams({
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
      useAuditSearchParams({
        search: { page: 3, limit: 50 },
        navigate,
      }),
    )

    result.current.setSearch({ page: 1, action: 'delete' })

    expect(navigate).toHaveBeenCalledTimes(1)
  })
})
