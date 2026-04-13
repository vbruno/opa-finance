import type { PropsWithChildren } from 'react'

type TransactionsCreateModalProps = PropsWithChildren<{
  isOpen: boolean
  onClose: () => void
}>

export function TransactionsCreateModal({
  isOpen,
  onClose,
  children,
}: TransactionsCreateModalProps) {
  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="fixed inset-0" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90dvh] overflow-y-auto overscroll-contain rounded-lg border bg-background p-4 shadow-lg sm:p-6">
        <div>
          <h3 className="text-lg font-semibold">Nova transação</h3>
          <p className="text-sm text-muted-foreground">
            Preencha os dados para registrar uma nova transação.
          </p>
        </div>
        {children}
      </div>
    </div>
  )
}
