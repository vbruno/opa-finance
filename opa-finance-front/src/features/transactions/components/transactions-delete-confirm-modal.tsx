import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { ShortcutTooltip } from '@/components/ui/shortcut-hint'
import { getApiErrorMessage } from '@/lib/apiError'

import type { Transaction } from '../transactions.api'
import { useDeleteTransaction } from '../transactions.api'

type TransactionsDeleteConfirmModalProps = {
  open: boolean
  transaction: Transaction | null
  onClose: () => void
  onDeleted: () => void
}

export function TransactionsDeleteConfirmModal({
  open,
  transaction,
  onClose,
  onDeleted,
}: TransactionsDeleteConfirmModalProps) {
  const modalRef = useRef<HTMLDivElement | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const deleteTransactionMutation = useDeleteTransaction()

  useEffect(() => {
    if (!open || !transaction) {
      setDeleteError(null)
      return
    }
    const id = window.setTimeout(() => {
      modalRef.current?.focus()
    }, 0)
    return () => window.clearTimeout(id)
  }, [open, transaction])

  const handleClose = () => {
    if (isDeleting) return
    onClose()
  }

  const handleConfirmDelete = async () => {
    if (!transaction || isDeleting) return
    setIsDeleting(true)
    try {
      await deleteTransactionMutation.mutateAsync(transaction.id)
      onClose()
      onDeleted()
    } catch (error: unknown) {
      setDeleteError(
        getApiErrorMessage(error, {
          defaultMessage: 'Erro ao excluir transação. Tente novamente.',
        }),
      )
    } finally {
      setIsDeleting(false)
    }
  }

  if (!open || !transaction) {
    return null
  }

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
            Tem certeza que deseja excluir esta transação? Essa ação não pode
            ser desfeita.
          </p>
        </div>

        {deleteError && (
          <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {deleteError}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <ShortcutTooltip label="Atalho: Esc">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={handleClose}
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
            disabled={isDeleting}
          >
            {isDeleting ? 'Excluindo...' : 'Excluir'}
          </Button>
        </div>
      </div>
    </div>
  )
}
