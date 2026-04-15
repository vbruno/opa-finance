import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useAccountsFormActions } from '@/features/accounts/hooks/use-accounts-form-actions'

describe('useAccountsFormActions', () => {
  it('abre edição e reseta formulário com dados da conta', () => {
    const resetEditForm = vi.fn()
    const openEditModal = vi.fn()

    const { result } = renderHook(() =>
      useAccountsFormActions({
        selectedAccount: { id: 'a-1', name: 'Conta A', type: 'cash' },
        createAccount: vi.fn(),
        updateAccount: vi.fn(),
        navigate: vi.fn(),
        resetCreateForm: vi.fn(),
        resetEditForm,
        setCreateFormError: vi.fn(),
        setEditFormError: vi.fn(),
        openEditModal,
        closeCreateModal: vi.fn(),
        closeEditModal: vi.fn(),
      }),
    )

    act(() => {
      result.current.openAccountEdit()
    })

    expect(resetEditForm).toHaveBeenCalledWith({
      name: 'Conta A',
      type: 'cash',
      confirm: false,
    })
    expect(openEditModal).toHaveBeenCalled()
  })

  it('submete criação com payload mapeado', async () => {
    const createAccount = vi.fn().mockResolvedValue(undefined)
    const closeCreateModal = vi.fn()
    const resetCreateForm = vi.fn()

    const { result } = renderHook(() =>
      useAccountsFormActions({
        selectedAccount: null,
        createAccount,
        updateAccount: vi.fn(),
        navigate: vi.fn(),
        resetCreateForm,
        resetEditForm: vi.fn(),
        setCreateFormError: vi.fn(),
        setEditFormError: vi.fn(),
        openEditModal: vi.fn(),
        closeCreateModal,
        closeEditModal: vi.fn(),
      }),
    )

    await act(async () => {
      await result.current.submitCreateAccount({
        name: 'Conta Nova',
        type: 'checking_account',
        confirm: true,
      })
    })

    expect(createAccount).toHaveBeenCalledWith({
      name: 'Conta Nova',
      type: 'checking_account',
    })
    expect(closeCreateModal).toHaveBeenCalled()
    expect(resetCreateForm).toHaveBeenCalled()
  })

  it('submete edição e limpa id da URL', async () => {
    const updateAccount = vi.fn().mockResolvedValue(undefined)
    const navigate = vi.fn()
    const closeEditModal = vi.fn()
    const resetEditForm = vi.fn()

    const { result } = renderHook(() =>
      useAccountsFormActions({
        selectedAccount: { id: 'a-1', name: 'Conta A', type: 'cash' },
        createAccount: vi.fn(),
        updateAccount,
        navigate,
        resetCreateForm: vi.fn(),
        resetEditForm,
        setCreateFormError: vi.fn(),
        setEditFormError: vi.fn(),
        openEditModal: vi.fn(),
        closeCreateModal: vi.fn(),
        closeEditModal,
      }),
    )

    await act(async () => {
      await result.current.submitEditAccount({
        name: 'Conta Editada',
        type: 'savings_account',
        confirm: true,
      })
    })

    expect(updateAccount).toHaveBeenCalledWith({
      id: 'a-1',
      payload: { name: 'Conta Editada', type: 'savings_account' },
    })
    expect(closeEditModal).toHaveBeenCalled()
    expect(navigate).toHaveBeenCalled()
    expect(resetEditForm).toHaveBeenCalled()
  })
})
