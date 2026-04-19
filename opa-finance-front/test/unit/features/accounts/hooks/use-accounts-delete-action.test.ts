import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useAccountsDeleteAction } from '@/features/accounts/hooks/use-accounts-delete-action'

describe('useAccountsDeleteAction', () => {
  it('executa exclusão com sucesso e fecha modal/navega', async () => {
    const deleteAccount = vi.fn().mockResolvedValue(undefined)
    const navigate = vi.fn()
    const closeDeleteConfirmModal = vi.fn()

    const { result } = renderHook(() =>
      useAccountsDeleteAction({
        selectedAccountId: 'a-1',
        deleteAccount,
        navigate,
        closeDeleteConfirmModal,
      }),
    )

    await act(async () => {
      await result.current.submitDeleteAccount()
    })

    expect(deleteAccount).toHaveBeenCalledWith('a-1')
    expect(closeDeleteConfirmModal).toHaveBeenCalled()
    expect(navigate).toHaveBeenCalled()
    expect(result.current.deleteError).toBeNull()
    expect(result.current.deleteBlockedReason).toBeNull()
  })

  it('mapeia erro 409 para mensagem bloqueante', async () => {
    const deleteAccount = vi.fn().mockRejectedValue({
      response: {
        status: 409,
        data: { detail: 'Conta com recorrência ativa vinculada.' },
      },
    })

    const { result } = renderHook(() =>
      useAccountsDeleteAction({
        selectedAccountId: 'a-1',
        deleteAccount,
        navigate: vi.fn(),
        closeDeleteConfirmModal: vi.fn(),
      }),
    )

    await act(async () => {
      await result.current.submitDeleteAccount()
    })

    expect(result.current.deleteError).toBeNull()
    expect(result.current.deleteBlockedReason).toContain(
      'Finalize ou remapeie as recorrências',
    )
  })
})
