import type { RefObject } from 'react'

import { Button } from '@/components/ui/button'
import { ShortcutTooltip } from '@/components/ui/shortcut-hint'

type TransactionsDeleteConfirmModalProps = {
  isOpen: boolean
  deleteError: string | null
  isDeleting: boolean
  deleteModalRef: RefObject<HTMLDivElement | null>
  onClose: () => void
  onConfirmDelete: () => void | Promise<void>
}

export function TransactionsDeleteConfirmModal({
  isOpen,
  deleteError,
  isDeleting,
  deleteModalRef,
  onClose,
  onConfirmDelete,
}: TransactionsDeleteConfirmModalProps) {
  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="fixed inset-0" onClick={onClose} />
      <div
        className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-lg border bg-background p-4 shadow-lg sm:max-h-none sm:overflow-visible sm:p-6"
        ref={deleteModalRef}
        tabIndex={-1}
      >
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Confirmar exclusao</h3>
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
              onClick={onClose}
            >
              Cancelar
            </Button>
          </ShortcutTooltip>
          <Button
            variant="destructive"
            className="w-full sm:w-auto"
            onClick={() => {
              void onConfirmDelete()
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
