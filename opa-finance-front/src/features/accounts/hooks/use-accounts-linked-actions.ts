import { useCallback, useState } from 'react'

import type { AccountPayload } from '@/features/accounts/accounts.api'
import { isRecurrenceConflictMessage } from '@/features/accounts/model/accounts.helpers'
import { getApiErrorMessage } from '@/lib/apiError'

type SelectedAccountLike = {
  id: string
  isPrimary?: boolean
  isHiddenOnDashboard?: boolean
}

type UpdateAccountFn = (input: {
  id: string
  payload: AccountPayload
}) => Promise<unknown>

type UseAccountsLinkedActionsInput = {
  selectedAccount: SelectedAccountLike | null
  updateAccount: UpdateAccountFn
}

export function useAccountsLinkedActions({
  selectedAccount,
  updateAccount,
}: UseAccountsLinkedActionsInput) {
  const [isPrimaryConfirmOpen, setIsPrimaryConfirmOpen] = useState(false)
  const [isTogglingDashboardVisibility, setIsTogglingDashboardVisibility] =
    useState(false)
  const [dashboardVisibilityError, setDashboardVisibilityError] = useState<
    string | null
  >(null)
  const [isSettingPrimary, setIsSettingPrimary] = useState(false)
  const [primaryError, setPrimaryError] = useState<string | null>(null)

  const handleSetPrimaryAccount = useCallback(async () => {
    if (!selectedAccount || selectedAccount.isPrimary || isSettingPrimary) {
      return
    }
    setIsSettingPrimary(true)
    setPrimaryError(null)
    try {
      await updateAccount({
        id: selectedAccount.id,
        payload: { isPrimary: true },
      })
      setIsPrimaryConfirmOpen(false)
    } catch (error: unknown) {
      setPrimaryError(
        getApiErrorMessage(error, {
          defaultMessage: 'Erro ao definir conta principal. Tente novamente.',
        }),
      )
    } finally {
      setIsSettingPrimary(false)
    }
  }, [isSettingPrimary, selectedAccount, updateAccount])

  const handleToggleDashboardVisibility = useCallback(async () => {
    if (!selectedAccount || isTogglingDashboardVisibility) {
      return
    }

    setDashboardVisibilityError(null)
    setIsTogglingDashboardVisibility(true)
    try {
      await updateAccount({
        id: selectedAccount.id,
        payload: {
          isHiddenOnDashboard: !selectedAccount.isHiddenOnDashboard,
        },
      })
    } catch (error: unknown) {
      const message = getApiErrorMessage(error, {
        defaultMessage:
          'Erro ao atualizar visibilidade no dashboard. Tente novamente.',
      })
      const status = getErrorStatus(error)
      setDashboardVisibilityError(
        status === 409 && isRecurrenceConflictMessage(message)
          ? `${message} Finalize ou remapeie as recorrências antes de ocultar/inativar a conta.`
          : message,
      )
    } finally {
      setIsTogglingDashboardVisibility(false)
    }
  }, [isTogglingDashboardVisibility, selectedAccount, updateAccount])

  const openPrimaryConfirm = useCallback(() => {
    setPrimaryError(null)
    setIsPrimaryConfirmOpen(true)
  }, [])

  const closePrimaryConfirm = useCallback(() => {
    setIsPrimaryConfirmOpen(false)
  }, [])

  const resetLinkedErrors = useCallback(() => {
    setDashboardVisibilityError(null)
    setPrimaryError(null)
  }, [])

  return {
    isPrimaryConfirmOpen,
    isTogglingDashboardVisibility,
    dashboardVisibilityError,
    isSettingPrimary,
    primaryError,
    openPrimaryConfirm,
    closePrimaryConfirm,
    resetLinkedErrors,
    handleSetPrimaryAccount,
    handleToggleDashboardVisibility,
  }
}

function getErrorStatus(error: unknown) {
  if (!error || typeof error !== 'object' || !('response' in error)) {
    return undefined
  }
  const response = (error as { response?: { status?: number } }).response
  return response?.status
}
