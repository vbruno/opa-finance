import { useCallback, useEffect, useMemo, useState } from 'react'

import type { Transaction } from '../transactions.api'

type UseTransactionsSelectionInput = {
  transactions: Transaction[]
}

export function useTransactionsSelection({
  transactions,
}: UseTransactionsSelectionInput) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) {
        return prev
      }

      const idsOnPage = new Set(
        transactions.map((transaction) => transaction.id),
      )
      const next = new Set<string>()

      prev.forEach((id) => {
        if (idsOnPage.has(id)) {
          next.add(id)
        }
      })

      return next
    })
  }, [transactions])

  const selectedTransactions = useMemo(
    () =>
      transactions.filter((transaction) => selectedIds.has(transaction.id)),
    [selectedIds, transactions],
  )

  const selectedCount = selectedTransactions.length
  const allSelected =
    transactions.length > 0 && selectedCount === transactions.length
  const hasSelection = selectedCount > 0

  const selectedTotal = useMemo(
    () =>
      selectedTransactions.reduce((acc, transaction) => {
        const signedAmount =
          transaction.type === 'income'
            ? transaction.amount
            : -transaction.amount
        return acc + signedAmount
      }, 0),
    [selectedTransactions],
  )

  const selectedAverage =
    selectedCount >= 1 ? selectedTotal / selectedCount : 0

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const toggleTransactionSelection = useCallback((transactionId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(transactionId)) {
        next.delete(transactionId)
      } else {
        next.add(transactionId)
      }
      return next
    })
  }, [])

  const selectAllOnPage = useCallback(() => {
    setSelectedIds(new Set(transactions.map((transaction) => transaction.id)))
  }, [transactions])

  const getBulkDeleteIds = useCallback((items: Transaction[]) => {
    const ids = new Set<string>()
    const seenTransfers = new Set<string>()

    items.forEach((transaction) => {
      if (transaction.transferId) {
        if (seenTransfers.has(transaction.transferId)) {
          return
        }
        seenTransfers.add(transaction.transferId)
      }
      ids.add(transaction.id)
    })

    return Array.from(ids)
  }, [])

  return {
    selectedIds,
    selectedTransactions,
    selectedCount,
    allSelected,
    hasSelection,
    selectedTotal,
    selectedAverage,
    clearSelection,
    toggleTransactionSelection,
    selectAllOnPage,
    getBulkDeleteIds,
  }
}
