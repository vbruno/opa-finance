import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useAccountsLinkedActions } from '@/features/accounts/hooks/use-accounts-linked-actions'

describe('useAccountsLinkedActions', () => {
  it('abre/fecha confirmação de principal', () => {
    const updateAccount = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useAccountsLinkedActions({
        selectedAccount: {
          id: 'a-1',
          isPrimary: false,
          isHiddenOnDashboard: false,
        },
        updateAccount,
      }),
    )

    act(() => {
      result.current.openPrimaryConfirm()
    })
    expect(result.current.isPrimaryConfirmOpen).toBe(true)

    act(() => {
      result.current.closePrimaryConfirm()
    })
    expect(result.current.isPrimaryConfirmOpen).toBe(false)
  })

  it('executa definição de conta principal', async () => {
    const updateAccount = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useAccountsLinkedActions({
        selectedAccount: {
          id: 'a-1',
          isPrimary: false,
          isHiddenOnDashboard: false,
        },
        updateAccount,
      }),
    )

    await act(async () => {
      await result.current.handleSetPrimaryAccount()
    })

    expect(updateAccount).toHaveBeenCalledWith({
      id: 'a-1',
      payload: { isPrimary: true },
    })
  })

  it('executa toggle de visibilidade no dashboard', async () => {
    const updateAccount = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useAccountsLinkedActions({
        selectedAccount: {
          id: 'a-1',
          isPrimary: false,
          isHiddenOnDashboard: false,
        },
        updateAccount,
      }),
    )

    await act(async () => {
      await result.current.handleToggleDashboardVisibility()
    })

    expect(updateAccount).toHaveBeenCalledWith({
      id: 'a-1',
      payload: { isHiddenOnDashboard: true },
    })
  })
})
