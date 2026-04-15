import { useCallback } from 'react'
import type { UseFormReset, UseFormSetError } from 'react-hook-form'

import {
  mapCreateAccountPayload,
  mapUpdateAccountPayload,
} from '@/features/accounts/mappers/accounts-payload.mapper'
import type { AccountsNavigateFn } from '@/features/accounts/model/accounts.types'
import { getApiErrorMessage } from '@/lib/apiError'
import type {
  AccountCreateFormData,
  AccountUpdateFormData,
} from '@/schemas/account.schema'

type SelectedAccountLike = {
  id: string
  name: string
  type: string
}

type UseAccountsFormActionsInput = {
  selectedAccount: SelectedAccountLike | null
  createAccount: (payload: ReturnType<typeof mapCreateAccountPayload>) => Promise<unknown>
  updateAccount: (input: {
    id: string
    payload: ReturnType<typeof mapUpdateAccountPayload>
  }) => Promise<unknown>
  navigate: AccountsNavigateFn
  resetCreateForm: UseFormReset<AccountCreateFormData>
  resetEditForm: UseFormReset<AccountUpdateFormData>
  setCreateFormError: UseFormSetError<AccountCreateFormData>
  setEditFormError: UseFormSetError<AccountUpdateFormData>
  openEditModal: () => void
  closeCreateModal: () => void
  closeEditModal: () => void
}

export function useAccountsFormActions({
  selectedAccount,
  createAccount,
  updateAccount,
  navigate,
  resetCreateForm,
  resetEditForm,
  setCreateFormError,
  setEditFormError,
  openEditModal,
  closeCreateModal,
  closeEditModal,
}: UseAccountsFormActionsInput) {
  const openAccountEdit = useCallback(() => {
    if (!selectedAccount) {
      return
    }
    resetEditForm({
      name: selectedAccount.name,
      type: selectedAccount.type,
      confirm: false,
    })
    openEditModal()
  }, [openEditModal, resetEditForm, selectedAccount])

  const submitCreateAccount = useCallback(
    async (formData: AccountCreateFormData) => {
      try {
        await createAccount(mapCreateAccountPayload(formData))
        closeCreateModal()
        resetCreateForm()
      } catch (error: unknown) {
        setCreateFormError('root', {
          message: getApiErrorMessage(error, {
            defaultMessage: 'Erro ao criar conta. Tente novamente.',
          }),
        })
      }
    },
    [closeCreateModal, createAccount, resetCreateForm, setCreateFormError],
  )

  const submitEditAccount = useCallback(
    async (formData: AccountUpdateFormData) => {
      if (!selectedAccount) {
        return
      }
      try {
        await updateAccount({
          id: selectedAccount.id,
          payload: mapUpdateAccountPayload(formData),
        })
        closeEditModal()
        navigate({
          search: (prev) => ({ ...prev, id: undefined }),
          replace: true,
        })
        resetEditForm()
      } catch (error: unknown) {
        setEditFormError('root', {
          message: getApiErrorMessage(error, {
            defaultMessage: 'Erro ao atualizar conta. Tente novamente.',
          }),
        })
      }
    },
    [
      closeEditModal,
      navigate,
      resetEditForm,
      selectedAccount,
      setEditFormError,
      updateAccount,
    ],
  )

  return {
    openAccountEdit,
    submitCreateAccount,
    submitEditAccount,
  }
}
