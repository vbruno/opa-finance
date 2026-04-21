import { Button } from '@/components/ui/button'
import type { Account } from '@/features/accounts'
import { getBalanceToneClass } from '@/features/accounts/model/accounts.helpers'
import { formatCurrencyValue } from '@/lib/utils'

type AccountsMobileListProps = {
  isLoading: boolean
  isError: boolean
  accounts: Account[]
  sortedAccountsCount: number
  paginatedAccounts: Account[]
  selectedAccountIds: Set<string>
  selectedCount: number
  selectedTotal: number
  allSelectedOnPage: boolean
  displayedTotal: number
  accountTypeLabels: Record<string, string>
  onOpenAccount: (accountId: string) => void
  onToggleSelectAllOnPage: (checked: boolean) => void
  onSetAccountSelected: (accountId: string, checked: boolean) => void
  onOpenCreateModal: () => void
}

export function AccountsMobileList({
  isLoading,
  isError,
  accounts,
  sortedAccountsCount,
  paginatedAccounts,
  selectedAccountIds,
  selectedCount,
  selectedTotal,
  allSelectedOnPage,
  displayedTotal,
  accountTypeLabels,
  onOpenAccount,
  onToggleSelectAllOnPage,
  onSetAccountSelected,
  onOpenCreateModal,
}: AccountsMobileListProps) {
  const displayedTotalToneClass = getBalanceToneClass(displayedTotal)

  return (
    <div className="space-y-3 mobile-only">
      <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-4 py-3 text-sm">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            className="h-5 w-5"
            checked={allSelectedOnPage}
            onChange={(event) => onToggleSelectAllOnPage(event.target.checked)}
            aria-label="Selecionar todas as contas da página"
          />
          <span className="text-muted-foreground">
            {selectedCount > 0 ? 'Limpar seleção' : 'Selecionar tudo'}
          </span>
        </div>
        {selectedCount >= 1 ? (
          <span className="font-semibold text-muted-foreground">
            {selectedCount}
          </span>
        ) : null}
      </div>

      {isLoading && (
        <div className="rounded-lg border px-4 py-6 text-center text-sm text-muted-foreground">
          Carregando contas...
        </div>
      )}
      {isError && (
        <div className="rounded-lg border px-4 py-6 text-center text-sm text-destructive">
          Erro ao carregar contas. Tente novamente.
        </div>
      )}
      {!isLoading &&
        !isError &&
        paginatedAccounts.map((account) => {
          const displayBalance = account.currentBalance ?? 0
          const balanceClass = getBalanceToneClass(displayBalance)
          return (
            <div
              key={account.id}
              className="cursor-pointer rounded-lg border bg-background p-3 transition hover:bg-muted/30"
              onClick={() => onOpenAccount(account.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Conta</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{account.name}</p>
                    {account.isPrimary && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                        Principal
                      </span>
                    )}
                    {account.isHiddenOnDashboard && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                        Oculta no dashboard
                      </span>
                    )}
                  </div>
                </div>
                <input
                  type="checkbox"
                  className="h-5 w-5 cursor-pointer"
                  checked={selectedAccountIds.has(account.id)}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) =>
                    onSetAccountSelected(account.id, event.target.checked)
                  }
                  aria-label={`Selecionar conta ${account.name}`}
                />
              </div>
              <div className="mt-2 flex items-end justify-between gap-3 text-sm">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Tipo</p>
                  <p className="text-muted-foreground">
                    {accountTypeLabels[account.type] ?? account.type}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase text-muted-foreground">Saldo</p>
                  <p className={`sensitive text-sm font-semibold ${balanceClass}`}>
                    {`$ ${formatCurrencyValue(displayBalance)}`}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      {!isLoading && !isError && sortedAccountsCount === 0 && (
        <div className="rounded-lg border px-4 py-6 text-center">
          <div className="space-y-2">
            {accounts.length === 0 ? (
              <>
                <p className="text-sm font-medium">Nenhuma conta cadastrada ainda.</p>
                <Button size="sm" onClick={onOpenCreateModal}>
                  Criar conta
                </Button>
              </>
            ) : (
              <p className="text-sm font-medium">
                Nenhuma conta encontrada com os filtros atuais.
              </p>
            )}
          </div>
        </div>
      )}
      {!isLoading && !isError && sortedAccountsCount > 0 && (
        <div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">
              {selectedCount >= 1 ? 'Parcial' : 'Total'}
            </span>
            <span className={`sensitive font-semibold ${displayedTotalToneClass}`}>
              {`$ ${formatCurrencyValue(selectedCount >= 1 ? selectedTotal : displayedTotal)}`}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
