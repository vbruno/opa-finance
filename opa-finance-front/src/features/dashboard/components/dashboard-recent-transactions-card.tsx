import { List } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import type { Transaction } from '@/features/transactions/transactions.api'
import { formatCurrencyValue } from '@/lib/utils'

type DashboardRecentTransactionsCardProps = {
  isOpen: boolean
  showSkeleton: boolean
  errorMessage: string | null
  transactions: Transaction[]
  onToggleOpen: () => void
  onOpenTransaction: (transaction: Transaction) => void
  formatDateDisplay: (value: string) => string
  viewAllAction: ReactNode
}

export function DashboardRecentTransactionsCard({
  isOpen,
  showSkeleton,
  errorMessage,
  transactions,
  onToggleOpen,
  onOpenTransaction,
  formatDateDisplay,
  viewAllAction,
}: DashboardRecentTransactionsCardProps) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={onToggleOpen}
            aria-label={isOpen ? 'Recolher transações' : 'Expandir transações'}
          >
            {isOpen ? '-' : '+'}
          </Button>
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <List className="h-6 w-6 text-muted-foreground" />
              Últimas transações
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-2">{viewAllAction}</div>
      </div>

      {isOpen && (
        <div className="mt-4 space-y-3">
          {showSkeleton &&
            Array.from({ length: 3 }).map((_, index) => (
              <div
                key={`transactions-skeleton-${index}`}
                className="flex items-center justify-between rounded-md border px-3 py-2 animate-pulse"
              >
                <div className="space-y-2">
                  <div className="h-4 w-32 rounded bg-muted/60" />
                  <div className="h-3 w-24 rounded bg-muted/60" />
                </div>
                <div className="space-y-2 text-right">
                  <div className="h-4 w-20 rounded bg-muted/60" />
                  <div className="h-3 w-16 rounded bg-muted/60" />
                </div>
              </div>
            ))}
          {errorMessage && (
            <p className="text-sm text-destructive">{errorMessage}</p>
          )}
          {!showSkeleton && !errorMessage && transactions.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhuma transação encontrada no período.
            </p>
          )}
          {!showSkeleton &&
            transactions.map((transaction) => (
              <button
                key={transaction.id}
                type="button"
                className="flex w-full cursor-pointer flex-col gap-2 rounded-md border px-3 py-2 text-left text-sm transition hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                onClick={() => onOpenTransaction(transaction)}
              >
                <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start">
                  <span className="font-medium">
                    {transaction.description || 'Sem descrição'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {transaction.subcategoryName ||
                      transaction.categoryName ||
                      'Sem categoria'}
                  </span>
                </div>
                <div className="flex w-full items-center justify-between gap-3 text-left sm:w-auto sm:justify-end sm:text-right">
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
      )}
    </div>
  )
}
