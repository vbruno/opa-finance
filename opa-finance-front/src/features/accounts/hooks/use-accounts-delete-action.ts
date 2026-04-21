import { useCallback, useState } from 'react'

import { resolveAccountDeleteErrorFeedback } from '@/features/accounts/model/accounts-errors.helpers'
import { isRecurrenceConflictMessage } from '@/features/accounts/model/accounts.helpers'
import { getApiErrorMessage, getApiErrorStatus } from '@/lib/apiError'

type AccountsNavigateFn = (input: {
  search: (prev: Record<string, unknown>) => Record<string, unknown>
  replace: boolean
}) => void

type UseAccountsDeleteActionInput = {
  selectedAccountId: string | null
  actions: {
    deleteAccount: (id: string) => Promise<unknown>
    navigate: AccountsNavigateFn
    closeDeleteConfirmModal: () => void
  }
}

export function useAccountsDeleteAction({
  selectedAccountId,
  actions,
}: UseAccountsDeleteActionInput) {
  const { deleteAccount, navigate, closeDeleteConfirmModal } = actions
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteBlockedReason, setDeleteBlockedReason] = useState<string | null>(
    null,
  )

  const resetDeleteFeedback = useCallback(() => {
    setDeleteBlockedReason(null)
    setDeleteError(null)
  }, [])

  const submitDeleteAccount = useCallback(async () => {
    if (!selectedAccountId) {
      return
    }

    resetDeleteFeedback()
    try {
      await deleteAccount(selectedAccountId)
      closeDeleteConfirmModal()
      navigate({
        search: (prev) => ({ ...prev, id: undefined }),
        replace: true,
      })
    } catch (error: unknown) {
      const status = getApiErrorStatus(error)
      const message = getApiErrorMessage(error, {
        defaultMessage: 'Erro ao excluir conta. Tente novamente.',
      })
      const feedback = resolveAccountDeleteErrorFeedback({
        status,
        message,
        isRecurrenceConflict: isRecurrenceConflictMessage(message),
      })
      setDeleteError(feedback.deleteError)
      setDeleteBlockedReason(feedback.deleteBlockedReason)
    }
  }, [
    closeDeleteConfirmModal,
    deleteAccount,
    navigate,
    resetDeleteFeedback,
    selectedAccountId,
  ])

  return {
    deleteError,
    deleteBlockedReason,
    setDeleteError,
    setDeleteBlockedReason,
    resetDeleteFeedback,
    submitDeleteAccount,
  }
}
