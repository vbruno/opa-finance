import type { RefObject } from 'react'

import type { Transaction } from '@/features/transactions/transactions.api'
import { formatCurrencyValue } from '@/lib/utils'

type DashboardTransactionDetailsModalProps = {
  selectedTransaction: Transaction | null
  accountNameById: Map<string, string>
  copiedField: 'description' | 'amount' | null
  modalRef: RefObject<HTMLDivElement | null>
  onClose: () => void
  onCopyDetail: (value: string, field: 'description' | 'amount') => void
  formatDateDisplay: (value: string) => string
}

export function DashboardTransactionDetailsModal({
  selectedTransaction,
  accountNameById,
  copiedField,
  modalRef,
  onClose,
  onCopyDetail,
  formatDateDisplay,
}: DashboardTransactionDetailsModalProps) {
  if (!selectedTransaction) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="fixed inset-0" onClick={onClose} />
      <div
        className="relative w-full max-w-lg rounded-lg border bg-background p-4 shadow-lg sm:p-6"
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
              {formatDateDisplay(selectedTransaction.date)}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground">Descrição</span>
            <span className="relative">
              <button
                type="button"
                className="cursor-pointer font-medium hover:underline"
                onClick={() =>
                  onCopyDetail(
                    selectedTransaction.description || 'Sem descrição',
                    'description',
                  )
                }
              >
                {selectedTransaction.description || 'Sem descrição'}
              </button>
              {copiedField === 'description' && (
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
                accountNameById.get(selectedTransaction.accountId) ||
                '-'}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground">Categoria</span>
            <span className="font-medium">
              {selectedTransaction.categoryName || '-'}
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
                  onCopyDetail(
                    formatCurrencyValue(selectedTransaction.amount),
                    'amount',
                  )
                }
              >
                {formatCurrencyValue(selectedTransaction.amount)}
              </button>
              {copiedField === 'amount' && (
                <span className="absolute -top-6 right-0 rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground shadow-sm">
                  Copiado!
                </span>
              )}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Notas</span>
            <span className="font-medium">
              {selectedTransaction.notes || 'Sem notas'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Criada em</span>
            <span className="font-medium">
              {formatDateDisplay(selectedTransaction.createdAt)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
