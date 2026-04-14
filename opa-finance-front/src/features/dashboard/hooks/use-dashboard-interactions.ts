import { useCallback, useEffect, useRef, useState } from 'react'

import type { Transaction } from '@/features/transactions/transactions.api'

type UseDashboardInteractionsInput = {
  hasSelectedTopCategory: boolean
  clearSelectedTopCategory: () => void
}

export function useDashboardInteractions({
  hasSelectedTopCategory,
  clearSelectedTopCategory,
}: UseDashboardInteractionsInput) {
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null)
  const [detailCopiedField, setDetailCopiedField] = useState<
    'description' | 'amount' | null
  >(null)
  const detailModalRef = useRef<HTMLDivElement | null>(null)
  const detailCopyTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    if (selectedTransaction) {
      detailModalRef.current?.focus()
    }
  }, [selectedTransaction])

  useEffect(() => {
    return () => {
      if (detailCopyTimeoutRef.current) {
        window.clearTimeout(detailCopyTimeoutRef.current)
      }
    }
  }, [])

  const handleCopyDetail = useCallback(
    async (value: string, field: 'description' | 'amount') => {
      if (!navigator?.clipboard?.writeText) {
        return
      }
      try {
        await navigator.clipboard.writeText(value)
        setDetailCopiedField(field)
        if (detailCopyTimeoutRef.current) {
          window.clearTimeout(detailCopyTimeoutRef.current)
        }
        detailCopyTimeoutRef.current = window.setTimeout(() => {
          setDetailCopiedField(null)
        }, 1500)
      } catch {
        // ignore clipboard errors
      }
    },
    [],
  )

  useEffect(() => {
    if (!hasSelectedTopCategory && !selectedTransaction) {
      return
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }
      if (selectedTransaction) {
        setSelectedTransaction(null)
        return
      }
      if (hasSelectedTopCategory) {
        clearSelectedTopCategory()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [clearSelectedTopCategory, hasSelectedTopCategory, selectedTransaction])

  return {
    selectedTransaction,
    setSelectedTransaction,
    detailCopiedField,
    detailModalRef,
    handleCopyDetail,
  }
}
