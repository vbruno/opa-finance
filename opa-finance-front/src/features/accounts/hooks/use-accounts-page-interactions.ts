import { useEffect, type RefObject } from 'react'

import type { Account } from '@/features/accounts'
import type { AccountsNavigateFn } from '@/features/accounts/model/accounts.types'

type AccountsPageInteractionsParams = {
  pagination: {
    currentPage: number
    totalPages: number
  }
  selection: {
    selectedAccountId: string | null
    selectedAccount: Account | undefined
    isAccountsLoading: boolean
  }
  modalState: {
    hasOpenModal: boolean
    isCreateOpen: boolean
    isEditOpen: boolean
    isDeleteConfirmOpen: boolean
    isPrimaryConfirmOpen: boolean
    isTogglingDashboardVisibility: boolean
    isSettingPrimary: boolean
  }
  modalSetters: {
    setIsCreateOpen: (value: boolean) => void
    setIsEditOpen: (value: boolean) => void
    setIsDeleteConfirmOpen: (value: boolean) => void
  }
  refs: {
    createNameRef: RefObject<HTMLInputElement | null>
    editNameRef: RefObject<HTMLInputElement | null>
    detailModalRef: RefObject<HTMLDivElement | null>
    deleteModalRef: RefObject<HTMLDivElement | null>
  }
  actions: {
    navigate: AccountsNavigateFn
    resetLinkedErrors: () => void
    setDeleteError: (value: string | null) => void
    setDeleteBlockedReason: (value: string | null) => void
    resetCreateForm: () => void
    openAccountDeleteConfirm: () => void
    openAccountEdit: () => void
    openPrimaryConfirm: () => void
    closePrimaryConfirm: () => void
    handleToggleDashboardVisibility: () => Promise<void>
    submitCreateAccount: () => Promise<void>
    submitEditAccount: () => Promise<void>
  }
}

function isTypingTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null
  const tagName = element?.tagName?.toLowerCase()
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    element?.isContentEditable
  )
}

export function useAccountsPageInteractions({
  pagination,
  selection,
  modalState,
  modalSetters,
  refs,
  actions,
}: AccountsPageInteractionsParams) {
  const { currentPage, totalPages } = pagination
  const { selectedAccountId, selectedAccount, isAccountsLoading } = selection
  const {
    hasOpenModal,
    isCreateOpen,
    isEditOpen,
    isDeleteConfirmOpen,
    isPrimaryConfirmOpen,
    isTogglingDashboardVisibility,
    isSettingPrimary,
  } = modalState
  const { setIsCreateOpen, setIsEditOpen, setIsDeleteConfirmOpen } = modalSetters
  const { createNameRef, editNameRef, detailModalRef, deleteModalRef } = refs
  const {
    navigate,
    resetLinkedErrors,
    setDeleteError,
    setDeleteBlockedReason,
    resetCreateForm,
    openAccountDeleteConfirm,
    openAccountEdit,
    openPrimaryConfirm,
    closePrimaryConfirm,
    handleToggleDashboardVisibility,
    submitCreateAccount,
    submitEditAccount,
  } = actions

  useEffect(() => {
    setDeleteError(null)
    setDeleteBlockedReason(null)
    resetLinkedErrors()
  }, [resetLinkedErrors, selectedAccountId, setDeleteBlockedReason, setDeleteError])

  useEffect(() => {
    const nextPage =
      totalPages > 0 ? Math.min(currentPage, totalPages) : currentPage

    if (selectedAccountId && !isAccountsLoading && !selectedAccount) {
      navigate({
        search: (prev) => ({ ...prev, id: undefined }),
        replace: true,
      })
      return
    }

    if (nextPage !== currentPage) {
      navigate({
        search: (prev) => ({ ...prev, page: nextPage }),
        replace: true,
      })
    }
  }, [
    currentPage,
    isAccountsLoading,
    navigate,
    selectedAccount,
    selectedAccountId,
    totalPages,
  ])

  useEffect(() => {
    if (!hasOpenModal) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [hasOpenModal])

  useEffect(() => {
    if (!isCreateOpen) {
      return
    }
    createNameRef.current?.focus()
  }, [createNameRef, isCreateOpen])

  useEffect(() => {
    if (!isEditOpen) {
      return
    }
    editNameRef.current?.focus()
  }, [editNameRef, isEditOpen])

  useEffect(() => {
    if (isDeleteConfirmOpen) {
      deleteModalRef.current?.focus()
      return
    }
    if (selectedAccount && !isEditOpen) {
      detailModalRef.current?.focus()
    }
  }, [
    deleteModalRef,
    detailModalRef,
    isDeleteConfirmOpen,
    isEditOpen,
    selectedAccount,
  ])

  useEffect(() => {
    if (
      !selectedAccount ||
      isEditOpen ||
      isDeleteConfirmOpen ||
      isPrimaryConfirmOpen
    ) {
      return
    }

    const detailAccount = selectedAccount

    function handleDetailShortcut(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) {
        return
      }

      const key = event.key.toLowerCase()
      if (key === 'r') {
        event.preventDefault()
        openAccountDeleteConfirm()
        return
      }

      if (key === 'e') {
        event.preventDefault()
        openAccountEdit()
        return
      }

      const visibilityShortcutKey = detailAccount.isHiddenOnDashboard ? 'm' : 'o'
      if (
        key === visibilityShortcutKey &&
        !detailAccount.isPrimary &&
        !isTogglingDashboardVisibility
      ) {
        event.preventDefault()
        void handleToggleDashboardVisibility()
      }
    }

    window.addEventListener('keydown', handleDetailShortcut, true)
    return () => window.removeEventListener('keydown', handleDetailShortcut, true)
  }, [
    handleToggleDashboardVisibility,
    isDeleteConfirmOpen,
    isEditOpen,
    isPrimaryConfirmOpen,
    isTogglingDashboardVisibility,
    openAccountDeleteConfirm,
    openAccountEdit,
    selectedAccount,
  ])

  useEffect(() => {
    if (!hasOpenModal) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') {
        return
      }

      if (isPrimaryConfirmOpen) {
        closePrimaryConfirm()
        return
      }

      if (isDeleteConfirmOpen) {
        setIsDeleteConfirmOpen(false)
        return
      }

      if (isEditOpen) {
        setIsEditOpen(false)
        navigate({
          search: (prev) => ({ ...prev, id: undefined }),
          replace: true,
        })
        return
      }

      if (isCreateOpen) {
        setIsCreateOpen(false)
        return
      }

      if (selectedAccount) {
        navigate({
          search: (prev) => ({ ...prev, id: undefined }),
          replace: true,
        })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    closePrimaryConfirm,
    hasOpenModal,
    isCreateOpen,
    isDeleteConfirmOpen,
    isEditOpen,
    isPrimaryConfirmOpen,
    navigate,
    selectedAccount,
    setIsCreateOpen,
    setIsDeleteConfirmOpen,
    setIsEditOpen,
  ])

  useEffect(() => {
    const hasAnyModalOpen =
      isCreateOpen ||
      isEditOpen ||
      isDeleteConfirmOpen ||
      isPrimaryConfirmOpen ||
      !!selectedAccount
    if (hasAnyModalOpen) {
      return
    }

    function handleCreateShortcut(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) {
        return
      }

      if (event.key.toLowerCase() !== 'n') {
        return
      }

      event.preventDefault()
      resetCreateForm()
      setIsCreateOpen(true)
    }

    window.addEventListener('keydown', handleCreateShortcut, true)
    return () => window.removeEventListener('keydown', handleCreateShortcut, true)
  }, [
    isCreateOpen,
    isDeleteConfirmOpen,
    isEditOpen,
    isPrimaryConfirmOpen,
    resetCreateForm,
    selectedAccount,
    setIsCreateOpen,
  ])

  useEffect(() => {
    if (!isCreateOpen) {
      return
    }

    function handleCreateShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault()
        void submitCreateAccount()
      }
    }

    window.addEventListener('keydown', handleCreateShortcut, true)
    return () => window.removeEventListener('keydown', handleCreateShortcut, true)
  }, [isCreateOpen, submitCreateAccount])

  useEffect(() => {
    if (!isEditOpen) {
      return
    }

    function handleEditShortcut(event: KeyboardEvent) {
      if (isPrimaryConfirmOpen) {
        return
      }

      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === 'p' &&
        selectedAccount &&
        !selectedAccount.isPrimary &&
        !isSettingPrimary
      ) {
        event.preventDefault()
        openPrimaryConfirm()
        return
      }

      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault()
        void submitEditAccount()
      }
    }

    window.addEventListener('keydown', handleEditShortcut, true)
    return () => window.removeEventListener('keydown', handleEditShortcut, true)
  }, [
    isEditOpen,
    isPrimaryConfirmOpen,
    isSettingPrimary,
    openPrimaryConfirm,
    selectedAccount,
    submitEditAccount,
  ])
}
