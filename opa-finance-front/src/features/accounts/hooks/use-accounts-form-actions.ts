import { useCallback } from 'react'
import type { UseFormReset, UseFormSetError } from 'react-hook-form'

import {
  mapCreateAccountPayload,
  mapUpdateAccountPayload,
} from '@/features/accounts/mappers/accounts-payload.mapper'
import type { AccountsNavigateFn } from '@/features/accounts/model/accounts.types'
import { setFormApiRootError } from '@/lib/form-api-error'
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
  services: {
    createAccount: (
      payload: ReturnType<typeof mapCreateAccountPayload>,
    ) => Promise<unknown>
    updateAccount: (input: {
      id: string
      payload: ReturnType<typeof mapUpdateAccountPayload>
    }) => Promise<unknown>
  }
  forms: {
    resetCreateForm: UseFormReset<AccountCreateFormData>
    resetEditForm: UseFormReset<AccountUpdateFormData>
    setCreateFormError: UseFormSetError<AccountCreateFormData>
    setEditFormError: UseFormSetError<AccountUpdateFormData>
  }
  modalActions: {
    openEditModal: () => void
    closeCreateModal: () => void
    closeEditModal: () => void
  }
  navigate: AccountsNavigateFn
}

export function useAccountsFormActions({
  selectedAccount,
  services,
  forms,
  modalActions,
  navigate,
}: UseAccountsFormActionsInput) {
  const { createAccount, updateAccount } = services
  const {
    resetCreateForm,
    resetEditForm,
    setCreateFormError,
    setEditFormError,
  } = forms
  const { openEditModal, closeCreateModal, closeEditModal } = modalActions

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
        setFormApiRootError({
          error,
          setError: setCreateFormError,
          options: {
            defaultMessage: 'Erro ao criar conta. Tente novamente.',
          },
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
        setFormApiRootError({
          error,
          setError: setEditFormError,
          options: {
            defaultMessage: 'Erro ao atualizar conta. Tente novamente.',
          },
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
