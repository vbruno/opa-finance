import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { ShortcutTooltip } from '@/components/ui/shortcut-hint'
import { getApiErrorMessage } from '@/lib/apiError'

import type { Transaction } from '../transactions.api'
import { useDeleteTransaction } from '../transactions.api'

type TransactionsBulkDeleteModalProps = {
  open: boolean
  selectedTransactions: Transaction[]
  onClose: () => void
  onDeleted: () => void
}

function getBulkDeleteIds(items: Transaction[]): string[] {
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
}

export function TransactionsBulkDeleteModal({
  open,
  selectedTransactions,
  onClose,
  onDeleted,
}: TransactionsBulkDeleteModalProps) {
  const modalRef = useRef<HTMLDivElement | null>(null)
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const deleteTransactionMutation = useDeleteTransaction()

  useEffect(() => {
    if (!open) {
      setBulkDeleteError(null)
      return
    }
    const id = window.setTimeout(() => {
      modalRef.current?.focus()
    }, 0)
    return () => window.clearTimeout(id)
  }, [open])

  const handleClose = () => {
    if (isBulkDeleting) return
    onClose()
  }

  const handleConfirmDelete = async () => {
    if (isBulkDeleting) return

    const idsArray = getBulkDeleteIds(selectedTransactions)
    if (idsArray.length === 0) {
      onClose()
      return
    }

    setIsBulkDeleting(true)
    setBulkDeleteError(null)
    try {
      const results = await Promise.allSettled(
        idsArray.map((id) => deleteTransactionMutation.mutateAsync(id)),
      )
      const hasError = results.some((result) => result.status === 'rejected')
      if (hasError) {
        setBulkDeleteError('Erro ao excluir transações. Tente novamente.')
        return
      }
      onClose()
      onDeleted()
    } catch (error: unknown) {
      setBulkDeleteError(
        getApiErrorMessage(error, {
          defaultMessage: 'Erro ao excluir transações. Tente novamente.',
        }),
      )
    } finally {
      setIsBulkDeleting(false)
    }
  }

  if (!open) {
    return null
  }

  const selectedCount = selectedTransactions.length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="fixed inset-0" onClick={handleClose} />
      <div
        className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-lg border bg-background p-4 shadow-lg sm:max-h-none sm:overflow-visible sm:p-6"
        ref={modalRef}
        tabIndex={-1}
      >
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Confirmar exclusão</h3>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir {selectedCount} transações
            selecionadas? Essa ação não pode ser desfeita.
          </p>
        </div>

        {bulkDeleteError && (
          <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {bulkDeleteError}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <ShortcutTooltip label="Atalho: Esc">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={handleClose}
              disabled={isBulkDeleting}
            >
              Cancelar
            </Button>
          </ShortcutTooltip>
          <Button
            variant="destructive"
            className="w-full sm:w-auto"
            onClick={() => {
              void handleConfirmDelete()
            }}
            disabled={isBulkDeleting}
          >
            {isBulkDeleting ? 'Excluindo...' : 'Excluir'}
          </Button>
        </div>
      </div>
    </div>
  )
}
