import { ArrowDownRight, ArrowUpRight, Wallet } from 'lucide-react'

import type { TransactionsSummary } from '@/features/transactions/transactions.api'
import { formatCurrencyValue } from '@/lib/utils'

type DashboardSummaryCardsProps = {
  showSummarySkeleton: boolean
  summary?: TransactionsSummary
}

export function DashboardSummaryCards({
  showSummarySkeleton,
  summary,
}: DashboardSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {showSummarySkeleton ? (
        Array.from({ length: 3 }).map((_, index) => (
          <div
            key={`summary-skeleton-${index}`}
            className={`animate-pulse rounded-lg border bg-background p-4 ${index === 2 ? 'col-span-2 sm:col-span-1' : ''}`}
          >
            <div className="h-4 w-20 rounded bg-muted/60" />
            <div className="mt-3 h-7 w-28 rounded bg-muted/60" />
          </div>
        ))
      ) : (
        <>
          <div className="rounded-lg border bg-background p-4">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowUpRight className="h-4 w-4 text-emerald-500" />
              Receitas
            </p>
            <p className="mt-2 text-2xl font-semibold text-emerald-600">
              <span className="sensitive">
                {summary ? formatCurrencyValue(summary.income) : '--'}
              </span>
            </p>
          </div>
          <div className="rounded-lg border bg-background p-4">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowDownRight className="h-4 w-4 text-rose-500" />
              Despesas
            </p>
            <p className="mt-2 text-2xl font-semibold text-rose-600">
              <span className="sensitive">
                {summary ? formatCurrencyValue(summary.expense) : '--'}
              </span>
            </p>
          </div>
          <div className="col-span-2 rounded-lg border bg-background p-4 sm:col-span-1">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              Saldo
            </p>
            <p className="mt-2 text-2xl font-semibold">
              <span className="sensitive">
                {summary ? formatCurrencyValue(summary.balance) : '--'}
              </span>
            </p>
          </div>
        </>
      )}
    </div>
  )
}
