import { Banknote } from 'lucide-react'

import type { Account } from '@/features/accounts'
import { formatCurrencyValue } from '@/lib/utils'

type DashboardAccountsCardProps = {
  showSkeleton: boolean
  isError: boolean
  errorMessage: string | null
  allAccountsCount: number
  visibleAccounts: Account[]
  selectedAccountId: string | null
  totalBalance: number
  accountTypeLabels: Record<string, string>
  onSelectAccount: (accountId: string) => void
}

export function DashboardAccountsCard({
  showSkeleton,
  isError,
  errorMessage,
  allAccountsCount,
  visibleAccounts,
  selectedAccountId,
  totalBalance,
  accountTypeLabels,
  onSelectAccount,
}: DashboardAccountsCardProps) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="grid grid-cols-[1fr_auto] items-center gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Banknote className="h-6 w-6 text-muted-foreground" />
          Contas
        </h2>
        <p
          className={
            showSkeleton
              ? 'text-base font-semibold text-muted-foreground text-right'
              : totalBalance < 0
                ? 'sensitive text-base font-semibold text-rose-600 text-right pr-3'
                : totalBalance > 0
                  ? 'sensitive text-base font-semibold text-emerald-600 text-right pr-3'
                  : 'sensitive text-base font-semibold text-muted-foreground text-right pr-3'
          }
        >
          {showSkeleton ? '--' : formatCurrencyValue(totalBalance)}
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {showSkeleton &&
          Array.from({ length: 3 }).map((_, index) => (
            <div
              key={`accounts-skeleton-${index}`}
              className="flex items-center justify-between rounded-md border p-3 animate-pulse"
            >
              <div className="space-y-2">
                <div className="h-4 w-28 rounded bg-muted/60" />
                <div className="h-3 w-20 rounded bg-muted/60" />
              </div>
              <div className="h-4 w-16 rounded bg-muted/60" />
            </div>
          ))}
        {isError && errorMessage && (
          <p className="text-sm text-destructive">{errorMessage}</p>
        )}
        {!showSkeleton && !isError && visibleAccounts.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {allAccountsCount === 0
              ? 'Nenhuma conta cadastrada.'
              : 'Nenhuma conta visível no dashboard.'}
          </p>
        )}
        {!showSkeleton &&
          visibleAccounts.map((account) => {
            const isSelected = account.id === selectedAccountId
            const displayBalance = account.currentBalance ?? 0

            return (
              <button
                key={account.id}
                type="button"
                onClick={() => onSelectAccount(account.id)}
                className={
                  isSelected
                    ? 'flex w-full cursor-pointer items-center justify-between rounded-md border border-primary/60 bg-primary/5 p-3 text-left'
                    : 'flex w-full cursor-pointer items-center justify-between rounded-md border p-3 text-left hover:bg-muted/40'
                }
                aria-pressed={isSelected}
              >
                <div>
                  <p className="font-medium">{account.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {accountTypeLabels[account.type] ?? account.type}
                    {account.isPrimary && (
                      <span className="ml-2 rounded-full border px-2 py-0.5 text-xs">
                        Principal
                      </span>
                    )}
                  </p>
                </div>
                <p
                  className={
                    displayBalance < 0
                      ? 'sensitive font-semibold text-rose-600'
                      : displayBalance > 0
                        ? 'sensitive font-semibold text-emerald-600'
                        : 'sensitive font-semibold text-muted-foreground'
                  }
                >
                  {formatCurrencyValue(displayBalance)}
                </p>
              </button>
            )
          })}
      </div>
    </div>
  )
}
