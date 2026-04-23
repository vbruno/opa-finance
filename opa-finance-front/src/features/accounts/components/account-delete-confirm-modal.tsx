import type { RefObject } from 'react'

import { Button } from '@/components/ui/button'
import { ShortcutTooltip } from '@/components/ui/shortcut-hint'

type AccountDeleteConfirmModalProps = {
  isOpen: boolean
  accountName: string | null
  isPending: boolean
  deleteBlockedReason: string | null
  deleteError: string | null
  deleteModalRef: RefObject<HTMLDivElement | null>
  onClose: () => void
  onConfirm: () => void
}

export function AccountDeleteConfirmModal({
  isOpen,
  accountName,
  isPending,
  deleteBlockedReason,
  deleteError,
  deleteModalRef,
  onClose,
  onConfirm,
}: AccountDeleteConfirmModalProps) {
  if (!isOpen || !accountName) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div
        className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-lg border bg-background p-4 shadow-lg sm:max-h-none sm:overflow-visible sm:p-6"
        ref={deleteModalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-delete-modal-title"
        aria-describedby="account-delete-modal-description"
      >
        <div className="space-y-2">
          <h3 id="account-delete-modal-title" className="text-lg font-semibold">
            Confirmar exclusão
          </h3>
          <p
            id="account-delete-modal-description"
            className="text-sm text-muted-foreground"
          >
            Tem certeza que deseja excluir a conta{' '}
            <span className="font-medium">{accountName}</span>? Essa ação não pode
            ser desfeita.
          </p>
        </div>
        {deleteBlockedReason && (
          <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {deleteBlockedReason}
          </div>
        )}
        {deleteError && (
          <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {deleteError}
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <ShortcutTooltip label="Atalho: Esc">
            <Button variant="outline" className="w-full sm:w-auto" onClick={onClose}>
              Cancelar
            </Button>
          </ShortcutTooltip>
          <Button
            variant="destructive"
            className="w-full sm:w-auto"
            disabled={isPending}
            onClick={onConfirm}
          >
            {isPending ? 'Excluindo...' : 'Confirmar exclusão'}
          </Button>
        </div>
      </div>
    </div>
  )
}
