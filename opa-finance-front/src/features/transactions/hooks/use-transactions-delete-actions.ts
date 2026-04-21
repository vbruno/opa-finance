import { useCallback, useState } from 'react'

import { getApiErrorMessage } from '@/lib/apiError'

import type { Transaction } from '../transactions.api'

type UseTransactionsDeleteActionsInput = {
  isDeleteConfirmOpen: boolean
  selectedTransaction: Transaction | null
  selectedTransactions: Transaction[]
  getBulkDeleteIds: (transactions: Transaction[]) => string[]
  deleteTransaction: (id: string) => Promise<unknown>
  clearSelection: () => void
  setSelectedTransaction: (transaction: Transaction | null) => void
  setIsDeleteConfirmOpen: (open: boolean) => void
  setIsBulkDeleteOpen: (open: boolean) => void
}

export function useTransactionsDeleteActions({
  isDeleteConfirmOpen,
  selectedTransaction,
  selectedTransactions,
  getBulkDeleteIds,
  deleteTransaction,
  clearSelection,
  setSelectedTransaction,
  setIsDeleteConfirmOpen,
  setIsBulkDeleteOpen,
}: UseTransactionsDeleteActionsInput) {
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [isDeletingSingleTransaction, setIsDeletingSingleTransaction] =
    useState(false)

  const isDeletePending = isDeleteConfirmOpen && isDeletingSingleTransaction

  const clearDeleteError = useCallback(() => {
    setDeleteError(null)
  }, [])

  const openDeleteConfirm = useCallback(
    (transaction: Transaction) => {
      setSelectedTransaction(transaction)
      setDeleteError(null)
      setIsDeleteConfirmOpen(true)
    },
    [setIsDeleteConfirmOpen, setSelectedTransaction],
  )

  const closeDeleteConfirm = useCallback(() => {
    if (isDeletePending) {
      return
    }
    setIsDeleteConfirmOpen(false)
  }, [isDeletePending, setIsDeleteConfirmOpen])

  const submitDeleteSelectedTransaction = useCallback(async () => {
    if (!selectedTransaction || isDeletePending) {
      return
    }

    setIsDeletingSingleTransaction(true)
    try {
      await deleteTransaction(selectedTransaction.id)
      setIsDeleteConfirmOpen(false)
      setSelectedTransaction(null)
    } catch (error: unknown) {
      setDeleteError(
        getApiErrorMessage(error, {
          defaultMessage: 'Erro ao excluir transação. Tente novamente.',
        }),
      )
    } finally {
      setIsDeletingSingleTransaction(false)
    }
  }, [
    deleteTransaction,
    isDeletePending,
    selectedTransaction,
    setIsDeleteConfirmOpen,
    setSelectedTransaction,
  ])

  const openBulkDeleteConfirm = useCallback(() => {
    setBulkDeleteError(null)
    setIsBulkDeleteOpen(true)
  }, [setIsBulkDeleteOpen])

  const closeBulkDeleteConfirm = useCallback(() => {
    if (isBulkDeleting) {
      return
    }
    setIsBulkDeleteOpen(false)
  }, [isBulkDeleting, setIsBulkDeleteOpen])

  const submitBulkDelete = useCallback(async () => {
    if (isBulkDeleting) {
      return
    }

    const idsArray = getBulkDeleteIds(selectedTransactions)
    if (idsArray.length === 0) {
      setIsBulkDeleteOpen(false)
      return
    }

    setIsBulkDeleting(true)
    setBulkDeleteError(null)
    try {
      const results = await Promise.allSettled(
        idsArray.map((id) => deleteTransaction(id)),
      )
      const hasError = results.some((result) => result.status === 'rejected')
      if (hasError) {
        setBulkDeleteError('Erro ao excluir transações. Tente novamente.')
        return
      }

      setIsBulkDeleteOpen(false)
      clearSelection()
    } catch (error: unknown) {
      setBulkDeleteError(
        getApiErrorMessage(error, {
          defaultMessage: 'Erro ao excluir transações. Tente novamente.',
        }),
      )
    } finally {
      setIsBulkDeleting(false)
    }
  }, [
    clearSelection,
    deleteTransaction,
    getBulkDeleteIds,
    isBulkDeleting,
    selectedTransactions,
    setIsBulkDeleteOpen,
  ])

  return {
    deleteError,
    bulkDeleteError,
    isBulkDeleting,
    isDeletePending,
    clearDeleteError,
    openDeleteConfirm,
    closeDeleteConfirm,
    submitDeleteSelectedTransaction,
    openBulkDeleteConfirm,
    closeBulkDeleteConfirm,
    submitBulkDelete,
  }
}
