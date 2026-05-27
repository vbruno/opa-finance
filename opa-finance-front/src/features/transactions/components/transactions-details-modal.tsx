import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { ShortcutLabel, ShortcutTooltip } from '@/components/ui/shortcut-hint'
import { formatCurrencyValue } from '@/lib/utils'

import { formatDateDisplay } from '../model/transactions.helpers'
import type { Transaction } from '../transactions.api'

type TransactionsDetailsModalProps = {
  selectedTransaction: Transaction | null
  categoryMap: Map<string, string>
  accountMap: Map<string, string>
  repeatTransferError: string | null
  transferEditError: string | null
  isRepeatTransferLoading: boolean
  isEditTransferLoading: boolean
  onClose: () => void
  onOpenRepeatTransfer: (transaction: Transaction) => void
  onOpenDuplicate: (transaction: Transaction) => void
  onOpenEdit: (transaction: Transaction) => void
  onOpenEditTransfer: (transaction: Transaction) => void
  onOpenDelete: (transaction: Transaction) => void
}

const dateFormatter = new Intl.DateTimeFormat('pt-BR')

export function TransactionsDetailsModal({
  selectedTransaction,
  categoryMap,
  accountMap,
  repeatTransferError,
  transferEditError,
  isRepeatTransferLoading,
  isEditTransferLoading,
  onClose,
  onOpenRepeatTransfer,
  onOpenDuplicate,
  onOpenEdit,
  onOpenEditTransfer,
  onOpenDelete,
}: TransactionsDetailsModalProps) {
  const modalRef = useRef<HTMLDivElement | null>(null)
  const detailCopyTimeoutRef = useRef<number | null>(null)
  const [detailCopiedField, setDetailCopiedField] = useState<
    'description' | 'amount' | null
  >(null)

  useEffect(() => {
    if (!selectedTransaction) return
    const id = window.setTimeout(() => {
      modalRef.current?.focus()
    }, 0)
    return () => window.clearTimeout(id)
  }, [selectedTransaction])

  useEffect(() => {
    return () => {
      if (detailCopyTimeoutRef.current) {
        window.clearTimeout(detailCopyTimeoutRef.current)
      }
    }
  }, [])

  const handleCopyDetail = async (
    value: string,
    field: 'description' | 'amount',
  ) => {
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
  }

  if (!selectedTransaction) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="fixed inset-0" onClick={onClose} />
      <div
        className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-lg border bg-background p-4 shadow-lg sm:max-h-none sm:overflow-visible sm:p-6"
        ref={modalRef}
        tabIndex={-1}
      >
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Detalhes da transação</h3>
          <p className="text-sm text-muted-foreground">
            Informações da transação selecionada.
          </p>
        </div>

        <div className="mt-6 grid gap-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground">Data</span>
            <span className="font-medium">
              {formatDateDisplay(selectedTransaction.date, dateFormatter)}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground">Descrição</span>
            <span className="relative">
              <button
                type="button"
                className="cursor-pointer font-medium hover:underline"
                onClick={() =>
                  void handleCopyDetail(
                    selectedTransaction.description ||
                      categoryMap.get(selectedTransaction.categoryId) ||
                      'Sem descrição',
                    'description',
                  )
                }
              >
                {selectedTransaction.description ||
                  selectedTransaction.categoryName ||
                  categoryMap.get(selectedTransaction.categoryId) ||
                  'Sem descrição'}
              </button>
              {detailCopiedField === 'description' && (
                <span className="absolute -top-6 right-0 rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground shadow-sm">
                  Copiado!
                </span>
              )}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground">Conta</span>
            <span className="font-medium">
              {selectedTransaction.accountName ||
                accountMap.get(selectedTransaction.accountId) ||
                '-'}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground">Categoria</span>
            <span className="font-medium">
              {selectedTransaction.categoryName ||
                categoryMap.get(selectedTransaction.categoryId) ||
                '-'}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground">Subcategoria</span>
            <span className="font-medium">
              {selectedTransaction.subcategoryId
                ? selectedTransaction.subcategoryName || '-'
                : '-'}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground">Tipo</span>
            <span className="font-medium">
              {selectedTransaction.type === 'income' ? 'Receita' : 'Despesa'}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground">Valor</span>
            <span className="relative">
              <button
                type="button"
                className="sensitive cursor-pointer font-semibold hover:underline"
                onClick={() =>
                  void handleCopyDetail(
                    formatCurrencyValue(selectedTransaction.amount),
                    'amount',
                  )
                }
              >
                {formatCurrencyValue(selectedTransaction.amount)}
              </button>
              {detailCopiedField === 'amount' && (
                <span className="absolute -top-6 right-0 rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground shadow-sm">
                  Copiado!
                </span>
              )}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground">Notas</span>
            <span className="font-medium">
              {selectedTransaction.notes || 'Sem notas'}
            </span>
          </div>
          {selectedTransaction.recurrenceId ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted-foreground">Recorrência</span>
              <span className="font-medium text-right">
                {selectedTransaction.recurrenceDescription?.trim() ||
                  'Sem descrição'}
                {selectedTransaction.recurrenceSequence != null ? (
                  <span className="ml-2 tabular-nums text-muted-foreground">
                    ({selectedTransaction.recurrenceSequence}
                    {selectedTransaction.recurrenceTotal != null
                      ? `/${selectedTransaction.recurrenceTotal}`
                      : ''}
                    )
                  </span>
                ) : null}
              </span>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground">Criada em</span>
            <span className="font-medium">
              {formatDateDisplay(selectedTransaction.createdAt, dateFormatter)}
            </span>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end">
          <div className="flex w-full flex-col gap-3 sm:items-end">
            {repeatTransferError && (
              <p className="text-sm text-destructive">{repeatTransferError}</p>
            )}
            {transferEditError && (
              <p className="text-sm text-destructive">{transferEditError}</p>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
              {selectedTransaction.transferId ? (
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  disabled={isRepeatTransferLoading}
                  aria-busy={isRepeatTransferLoading}
                  onClick={() => onOpenRepeatTransfer(selectedTransaction)}
                >
                  {isRepeatTransferLoading ? 'Carregando...' : 'Repetir'}
                </Button>
              ) : (
                <ShortcutTooltip label="Atalho: D">
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => onOpenDuplicate(selectedTransaction)}
                  >
                    <ShortcutLabel label="Duplicar" shortcutIndex={0} />
                  </Button>
                </ShortcutTooltip>
              )}
              <ShortcutTooltip label="Atalho: E">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  autoFocus
                  disabled={
                    Boolean(selectedTransaction.transferId) &&
                    isEditTransferLoading
                  }
                  aria-busy={
                    Boolean(selectedTransaction.transferId) &&
                    isEditTransferLoading
                  }
                  onClick={() => {
                    if (selectedTransaction.transferId) {
                      onOpenEditTransfer(selectedTransaction)
                    } else {
                      onOpenEdit(selectedTransaction)
                    }
                  }}
                >
                  {selectedTransaction.transferId && isEditTransferLoading ? (
                    'Carregando...'
                  ) : (
                    <ShortcutLabel label="Editar" shortcutIndex={0} />
                  )}
                </Button>
              </ShortcutTooltip>
              <ShortcutTooltip label="Atalho: R">
                <Button
                  variant="destructive"
                  className="w-full sm:w-auto"
                  onClick={() => onOpenDelete(selectedTransaction)}
                >
                  <ShortcutLabel label="Excluir" shortcutIndex={6} />
                </Button>
              </ShortcutTooltip>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
