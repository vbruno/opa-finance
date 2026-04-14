import type { ReactNode } from 'react'

import type { Transaction } from '@/features/transactions/transactions.api'
import { formatCurrencyValue } from '@/lib/utils'

type DashboardSelectedTopCategory = {
  id: string
  name: string
  groupBy: 'category' | 'subcategory'
  type: 'income' | 'expense'
}

type DashboardTopCategoryTransactionsModalProps = {
  selectedTopCategory: DashboardSelectedTopCategory | null
  isLoading: boolean
  errorMessage: string | null
  transactions: Transaction[]
  onClose: () => void
  onOpenTransaction: (transaction: Transaction) => void
  formatDateDisplay: (value: string) => string
  viewAllAction: ReactNode
}

export function DashboardTopCategoryTransactionsModal({
  selectedTopCategory,
  isLoading,
  errorMessage,
  transactions,
  onClose,
  onOpenTransaction,
  formatDateDisplay,
  viewAllAction,
}: DashboardTopCategoryTransactionsModalProps) {
  if (!selectedTopCategory) {
    return null
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="fixed inset-0" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-lg border bg-background p-4 shadow-lg sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold">Últimos lançamentos</h3>
            <p className="text-sm text-muted-foreground">
              {selectedTopCategory.name}
            </p>
          </div>
          {viewAllAction}
        </div>

        <div className="mt-4 space-y-3">
          {isLoading && (
            <p className="text-sm text-muted-foreground">
              Carregando lançamentos...
            </p>
          )}
          {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
          {!isLoading && !errorMessage && transactions.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhuma transação encontrada no período.
            </p>
          )}
          {!isLoading &&
            !errorMessage &&
            transactions.map((transaction) => (
              <button
                key={transaction.id}
                type="button"
                className="flex w-full flex-col gap-2 rounded-md border px-3 py-2 text-left text-sm transition hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                onClick={() => onOpenTransaction(transaction)}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {transaction.description || 'Sem descrição'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-left sm:text-right">
                  <span
                    className={
                      transaction.type === 'income'
                        ? 'sensitive font-semibold text-emerald-600'
                        : 'sensitive font-semibold text-rose-600'
                    }
                  >
                    {transaction.type === 'income' ? '+' : '-'}{' '}
                    {formatCurrencyValue(transaction.amount)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateDisplay(transaction.date)}
                  </span>
                </div>
              </button>
            ))}
        </div>
      </div>
    </div>
  )
}
