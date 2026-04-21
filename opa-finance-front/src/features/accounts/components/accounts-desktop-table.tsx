import type { RefObject } from 'react'

import { Button } from '@/components/ui/button'
import type { Account } from '@/features/accounts'
import { AccountsSortIcon } from '@/features/accounts/components/accounts-sort-icon'
import type {
  AccountsSortDirection,
  AccountsSortKey,
} from '@/features/accounts/model/accounts.types'
import { formatCurrencyValue } from '@/lib/utils'

type AccountsDesktopTableProps = {
  isLoading: boolean
  isError: boolean
  isRefreshingAccounts: boolean
  accounts: Account[]
  sortedAccountsCount: number
  paginatedAccounts: Account[]
  selectedAccountIds: Set<string>
  selectedCount: number
  selectedTotal: number
  totalFilteredBalance: number
  allSelectedOnPage: boolean
  selectAllRef: RefObject<HTMLInputElement | null>
  sortKey: AccountsSortKey
  sortDirection: AccountsSortDirection
  accountTypeLabels: Record<string, string>
  onSort: (key: 'name' | 'type' | 'balance') => void
  onOpenAccount: (accountId: string) => void
  onToggleSelectAccount: (accountId: string) => void
  onSetAccountSelected: (accountId: string, checked: boolean) => void
  onToggleSelectAllOnPage: (checked: boolean) => void
  onOpenCreateModal: () => void
}

export function AccountsDesktopTable({
  isLoading,
  isError,
  isRefreshingAccounts,
  accounts,
  sortedAccountsCount,
  paginatedAccounts,
  selectedAccountIds,
  selectedCount,
  selectedTotal,
  totalFilteredBalance,
  allSelectedOnPage,
  selectAllRef,
  sortKey,
  sortDirection,
  accountTypeLabels,
  onSort,
  onOpenAccount,
  onToggleSelectAccount,
  onSetAccountSelected,
  onToggleSelectAllOnPage,
  onOpenCreateModal,
}: AccountsDesktopTableProps) {
  return (
    <div className="desktop-only">
      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-[640px] w-full text-left text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="w-[1%] px-3 py-3">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  className="h-4 w-4"
                  checked={allSelectedOnPage}
                  onChange={(event) => onToggleSelectAllOnPage(event.target.checked)}
                  aria-label="Selecionar todas as contas da página"
                />
              </th>
              <th className="px-4 py-3">
                <button
                  className="inline-flex items-center gap-2 text-left"
                  type="button"
                  onClick={() => onSort('name')}
                >
                  Conta
                  <AccountsSortIcon
                    isActive={sortKey === 'name'}
                    direction={sortDirection}
                  />
                </button>
              </th>
              <th className="w-[1%] px-4 py-3 whitespace-nowrap">
                <button
                  className="inline-flex items-center gap-2 text-left"
                  type="button"
                  onClick={() => onSort('type')}
                >
                  Tipo
                  <AccountsSortIcon
                    isActive={sortKey === 'type'}
                    direction={sortDirection}
                  />
                </button>
              </th>
              <th
                className={`w-[1%] px-4 py-3 text-right whitespace-nowrap ${
                  isRefreshingAccounts ? 'text-emerald-600' : ''
                }`}
              >
                <button
                  className="inline-flex items-center gap-2 text-right"
                  type="button"
                  onClick={() => onSort('balance')}
                >
                  Saldo atual
                  <AccountsSortIcon
                    isActive={sortKey === 'balance'}
                    direction={sortDirection}
                  />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center">
                  <p className="text-sm text-muted-foreground">Carregando contas...</p>
                </td>
              </tr>
            )}
            {isError && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center">
                  <p className="text-sm text-destructive">
                    Erro ao carregar contas. Tente novamente.
                  </p>
                </td>
              </tr>
            )}
            {!isLoading &&
              !isError &&
              paginatedAccounts.map((account) => {
                const displayBalance = account.currentBalance ?? 0
                return (
                  <tr
                    key={account.id}
                    className="cursor-pointer border-t hover:bg-muted/30"
                    onClick={() => onOpenAccount(account.id)}
                  >
                    <td
                      className="cursor-pointer px-3 py-3"
                      onClick={(event) => {
                        event.stopPropagation()
                        onToggleSelectAccount(account.id)
                      }}
                      onMouseDown={(event) => event.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 cursor-pointer"
                        checked={selectedAccountIds.has(account.id)}
                        onChange={(event) =>
                          onSetAccountSelected(account.id, event.target.checked)
                        }
                        aria-label={`Selecionar conta ${account.name}`}
                      />
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{account.name}</span>
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
                    </td>
                    <td className="px-4 py-3 text-center text-muted-foreground whitespace-nowrap">
                      {accountTypeLabels[account.type] ?? account.type}
                    </td>
                    <td
                      className={
                        displayBalance < 0
                          ? 'sensitive px-4 py-3 text-right font-semibold whitespace-nowrap text-rose-600'
                          : displayBalance > 0
                            ? 'sensitive px-4 py-3 text-right font-semibold whitespace-nowrap text-emerald-600'
                            : 'sensitive px-4 py-3 text-right font-semibold whitespace-nowrap text-muted-foreground'
                      }
                    >
                      {`$ ${formatCurrencyValue(displayBalance)}`}
                    </td>
                  </tr>
                )
              })}
            {!isLoading && !isError && sortedAccountsCount === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center">
                  <div className="space-y-2">
                    {accounts.length === 0 ? (
                      <>
                        <p className="text-sm font-medium">
                          Nenhuma conta cadastrada ainda.
                        </p>
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
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="bg-muted/20 text-sm">
            <tr className="border-t">
              <td className="px-4 py-3"></td>
              <td className="px-3 py-3 font-semibold text-muted-foreground">
                {selectedCount >= 1 ? `${selectedCount} selecionadas` : ''}
              </td>
              <td className="px-4 py-3 text-center font-semibold text-muted-foreground">
                {selectedCount >= 1 ? 'Parcial' : 'Total'}
              </td>
              <td
                className={
                  isLoading || isError
                    ? 'px-4 py-3 text-right font-semibold text-muted-foreground'
                    : (selectedCount >= 1 ? selectedTotal : totalFilteredBalance) < 0
                      ? 'sensitive px-4 py-3 text-right font-semibold text-rose-600'
                      : (selectedCount >= 1 ? selectedTotal : totalFilteredBalance) >
                          0
                        ? 'sensitive px-4 py-3 text-right font-semibold text-emerald-600'
                        : 'sensitive px-4 py-3 text-right font-semibold text-muted-foreground'
                }
              >
                {isLoading || isError
                  ? '--'
                  : `$ ${formatCurrencyValue(
                      selectedCount >= 1 ? selectedTotal : totalFilteredBalance,
                    )}`}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
