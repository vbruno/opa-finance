import { zodResolver } from '@hookform/resolvers/zod'
import { SlidersHorizontal } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ShortcutLabel, ShortcutTooltip } from '@/components/ui/shortcut-hint'
import {
  useAccounts,
  useCreateAccount,
  useDeleteAccount,
  useUpdateAccount,
} from '@/features/accounts'
import { AccountsSortIcon } from '@/features/accounts/components/accounts-sort-icon'
import { useAccountsFormActions } from '@/features/accounts/hooks/use-accounts-form-actions'
import { useAccountsLinkedActions } from '@/features/accounts/hooks/use-accounts-linked-actions'
import { useAccountsPageInteractions } from '@/features/accounts/hooks/use-accounts-page-interactions'
import { useAccountsSearchParams } from '@/features/accounts/hooks/use-accounts-search-params'
import { useAccountsSelection } from '@/features/accounts/hooks/use-accounts-selection'
import { getApiErrorStatus } from '@/features/accounts/model/accounts-errors.helpers'
import {
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPE_OPTIONS,
} from '@/features/accounts/model/accounts.constants'
import {
  filterAccounts,
  getBalanceToneClass,
  isRecurrenceConflictMessage,
  paginateAccounts,
  resolveAccountsDisplayedTotal,
  sortAccounts,
} from '@/features/accounts/model/accounts.helpers'
import {
  type AccountsNavigateFn,
  type AccountsSearchParams,
} from '@/features/accounts/model/accounts.types'
import { useUserPreference } from '@/hooks/useUserPreference'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatCurrencyValue } from '@/lib/utils'
import {
  accountCreateSchema,
  accountUpdateSchema,
  type AccountCreateFormData,
  type AccountUpdateFormData,
} from '@/schemas/account.schema'

type AccountsPageProps = {
  search: AccountsSearchParams
  navigate: AccountsNavigateFn
}

export function AccountsPage({ search, navigate }: AccountsPageProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteBlockedReason, setDeleteBlockedReason] = useState<string | null>(
    null,
  )
  const createNameRef = useRef<HTMLInputElement | null>(null)
  const editNameRef = useRef<HTMLInputElement | null>(null)
  const detailModalRef = useRef<HTMLDivElement | null>(null)
  const deleteModalRef = useRef<HTMLDivElement | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AccountCreateFormData>({
    resolver: zodResolver(accountCreateSchema),
    defaultValues: {
      name: '',
      type: undefined,
      confirm: false,
    },
  })

  const confirmValue = watch('confirm')

  const {
    register: editRegister,
    handleSubmit: handleEditSubmit,
    reset: resetEdit,
    watch: watchEdit,
    setError: setEditError,
    formState: { errors: editErrors, isSubmitting: isEditSubmitting },
  } = useForm<AccountUpdateFormData>({
    resolver: zodResolver(accountUpdateSchema),
    defaultValues: {
      name: '',
      type: undefined,
      confirm: false,
    },
  })

  const confirmEditValue = watchEdit('confirm')
  const createNameField = register('name')
  const editNameField = editRegister('name')

  const accountsQuery = useAccounts()

  const createAccountMutation = useCreateAccount()

  const updateAccountMutation = useUpdateAccount()

  const dateFormatter = new Intl.DateTimeFormat('pt-BR')
  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data])
  const isRefreshingAccounts =
    accountsQuery.isFetching && !accountsQuery.isLoading
  const {
    searchTerm,
    searchDraft,
    setSearchDraft,
    typeFilter,
    selectedAccountId,
    sortKey,
    sortDirection,
    currentPage,
    hasActiveFilters,
    normalizedSearch,
    handleSearchEnter,
    handleTypeFilterChange,
    handleClearFilters,
  } = useAccountsSearchParams({
    search,
    navigate,
  })
  const selectedAccount = accounts.find(
    (account) => account.id === selectedAccountId,
  )
  const accountTypeLabels: Record<string, string> = ACCOUNT_TYPE_LABELS
  const filteredAccounts = filterAccounts(accounts, searchTerm, typeFilter)
  const totalFilteredBalance = filteredAccounts.reduce(
    (total, account) => total + (account.currentBalance ?? 0),
    0,
  )
  const sortedAccounts = sortAccounts(
    filteredAccounts,
    sortKey,
    sortDirection,
    accountTypeLabels,
  )
  const {
    isPrimaryConfirmOpen,
    isTogglingDashboardVisibility,
    dashboardVisibilityError,
    isSettingPrimary,
    primaryError,
    openPrimaryConfirm,
    closePrimaryConfirm,
    resetLinkedErrors,
    handleSetPrimaryAccount,
    handleToggleDashboardVisibility,
  } = useAccountsLinkedActions({
    selectedAccount: selectedAccount ?? null,
    updateAccount: updateAccountMutation.mutateAsync,
  })

  const openAccountDeleteConfirm = () => {
    setDeleteBlockedReason(null)
    setDeleteError(null)
    setIsDeleteConfirmOpen(true)
  }

  const {
    openAccountEdit,
    submitCreateAccount: onSubmitCreateAccount,
    submitEditAccount: onSubmitEditAccount,
  } = useAccountsFormActions({
    selectedAccount: selectedAccount ?? null,
    createAccount: createAccountMutation.mutateAsync,
    updateAccount: updateAccountMutation.mutateAsync,
    navigate,
    resetCreateForm: reset,
    resetEditForm: resetEdit,
    setCreateFormError: setError,
    setEditFormError: setEditError,
    openEditModal: () => setIsEditOpen(true),
    closeCreateModal: () => setIsCreateOpen(false),
    closeEditModal: () => setIsEditOpen(false),
  })

  function handleSort(nextKey: 'name' | 'type' | 'balance') {
    navigate({
      search: (prev) => {
        const isSame = prev.sort === nextKey
        const nextDirection = isSame && prev.dir === 'asc' ? 'desc' : 'asc'
        return {
          ...prev,
          sort: nextKey,
          dir: nextDirection,
        }
      },
      replace: false,
    })
  }

  const [pageSize, setPageSize] = useUserPreference<number>(
    'accountsPageSize',
    10,
    {
      serialize: (value) => String(value),
      deserialize: (raw) => {
        const parsed = Number(raw)
        if (!Number.isFinite(parsed) || parsed <= 0) {
          return 10
        }
        return Math.min(50, Math.max(5, Math.floor(parsed)))
      },
    },
  )
  const { totalPages, safePage, paginatedAccounts } = paginateAccounts(
    sortedAccounts,
    currentPage,
    pageSize,
  )
  const hasOpenModal =
    isCreateOpen || isEditOpen || isDeleteConfirmOpen || !!selectedAccount
  const {
    selectedAccountIds,
    selectedCount,
    selectedTotal,
    allSelectedOnPage,
    selectAllRef,
    toggleSelectAllOnPage,
    toggleSelectAccount,
    setAccountSelected,
  } = useAccountsSelection({
    accounts,
    filteredAccounts,
    paginatedAccounts,
    normalizedSearch,
    typeFilter,
    hasOpenModal,
  })
  const displayedTotal = resolveAccountsDisplayedTotal({
    selectedCount,
    selectedTotal,
    totalFilteredBalance,
  })
  const displayedTotalToneClass = getBalanceToneClass(displayedTotal)

  const deleteAccountMutation = useDeleteAccount()

  const submitCreateAccount = handleSubmit(onSubmitCreateAccount)
  const submitEditAccount = handleEditSubmit(onSubmitEditAccount)

  useAccountsPageInteractions({
    currentPage,
    totalPages,
    selectedAccountId,
    selectedAccount,
    isAccountsLoading: accountsQuery.isLoading,
    navigate,
    resetLinkedErrors,
    setDeleteError,
    setDeleteBlockedReason,
    hasOpenModal,
    isCreateOpen,
    isEditOpen,
    isDeleteConfirmOpen,
    isPrimaryConfirmOpen,
    isTogglingDashboardVisibility,
    isSettingPrimary,
    setIsCreateOpen,
    setIsEditOpen,
    setIsDeleteConfirmOpen,
    resetCreateForm: reset,
    openAccountDeleteConfirm,
    openAccountEdit,
    openPrimaryConfirm,
    closePrimaryConfirm,
    handleToggleDashboardVisibility,
    submitCreateAccount,
    submitEditAccount,
    createNameRef,
    editNameRef,
    detailModalRef,
    deleteModalRef,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Contas</h2>
          {isRefreshingAccounts && (
            <p className="text-xs text-muted-foreground">
              Atualizando saldos...
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant={
              hasActiveFilters || isFiltersOpen ? 'secondary' : 'outline'
            }
            size="icon"
            className="h-10 w-10 sm:hidden"
            aria-label={isFiltersOpen ? 'Ocultar filtros' : 'Mostrar filtros'}
            onClick={() => setIsFiltersOpen((prev) => !prev)}
          >
            <SlidersHorizontal className="size-4" />
          </Button>
          <ShortcutTooltip label="Atalho: N">
            <Button
              onClick={() => {
                reset()
                setIsCreateOpen(true)
              }}
            >
              <ShortcutLabel label="Nova conta" shortcutIndex={0} />
            </Button>
          </ShortcutTooltip>
        </div>
      </div>

      <div
        className={`rounded-lg border bg-card p-4 ${
          isFiltersOpen ? 'block' : 'hidden'
        } desktop-force-block`}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <h3 className="text-base font-semibold">Filtros</h3>
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="w-full sm:min-w-[220px] sm:flex-1">
              <Input
                type="text"
                placeholder="Buscar por nome..."
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') {
                    return
                  }
                  handleSearchEnter(event.currentTarget.value)
                }}
              />
            </div>
            <div className="flex w-full items-center gap-2 sm:contents">
              <div className="w-full sm:w-56">
                <div className="relative">
                  <select
                    className="h-10 w-full appearance-none rounded-md border bg-background px-3 pr-10 text-sm"
                    value={typeFilter}
                    onChange={(event) =>
                      handleTypeFilterChange(event.target.value)
                    }
                  >
                    <option value="">Todos</option>
                    {ACCOUNT_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground">
                    <svg
                      viewBox="0 0 16 16"
                      className="h-4 w-4"
                      aria-hidden="true"
                    >
                      <path
                        d="M4 6l4 4 4-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </div>
              </div>
              <div className="flex h-10 items-center sm:w-auto sm:items-end sm:justify-end">
                <Button
                  variant="destructive"
                  size="icon"
                  disabled={!hasActiveFilters}
                  aria-label="Limpar filtros"
                  className="h-10 w-10"
                  onClick={handleClearFilters}
                >
                  x
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3 mobile-only">
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-4 py-3 text-sm">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              className="h-5 w-5"
              checked={allSelectedOnPage}
              onChange={(event) => toggleSelectAllOnPage(event.target.checked)}
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

        {accountsQuery.isLoading && (
          <div className="rounded-lg border px-4 py-6 text-center text-sm text-muted-foreground">
            Carregando contas...
          </div>
        )}
        {accountsQuery.isError && (
          <div className="rounded-lg border px-4 py-6 text-center text-sm text-destructive">
            Erro ao carregar contas. Tente novamente.
          </div>
        )}
        {!accountsQuery.isLoading &&
          !accountsQuery.isError &&
          paginatedAccounts.map((account) => {
            const displayBalance = account.currentBalance ?? 0
            const balanceClass = getBalanceToneClass(displayBalance)
            return (
              <div
                key={account.id}
                className="cursor-pointer rounded-lg border bg-background p-3 transition hover:bg-muted/30"
                onClick={() =>
                  navigate({
                    search: (prev) => ({ ...prev, id: account.id }),
                  })
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">
                      Conta
                    </p>
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
                      setAccountSelected(account.id, event.target.checked)
                    }
                    aria-label={`Selecionar conta ${account.name}`}
                  />
                </div>
                <div className="mt-2 flex items-end justify-between gap-3 text-sm">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">
                      Tipo
                    </p>
                    <p className="text-muted-foreground">
                      {accountTypeLabels[account.type] ?? account.type}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase text-muted-foreground">
                      Saldo
                    </p>
                    <p
                      className={`sensitive text-sm font-semibold ${balanceClass}`}
                    >
                      {`$ ${formatCurrencyValue(displayBalance)}`}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        {!accountsQuery.isLoading &&
          !accountsQuery.isError &&
          sortedAccounts.length === 0 && (
            <div className="rounded-lg border px-4 py-6 text-center">
              <div className="space-y-2">
                {accounts.length === 0 ? (
                  <>
                    <p className="text-sm font-medium">
                      Nenhuma conta cadastrada ainda.
                    </p>
                    <Button
                      size="sm"
                      onClick={() => {
                        reset()
                        setIsCreateOpen(true)
                      }}
                    >
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
        {!accountsQuery.isLoading &&
          !accountsQuery.isError &&
          sortedAccounts.length > 0 && (
            <div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {selectedCount >= 1 ? 'Parcial' : 'Total'}
                </span>
                <span className={`sensitive font-semibold ${displayedTotalToneClass}`}>
                  {`$ ${formatCurrencyValue(displayedTotal)}`}
                </span>
              </div>
            </div>
          )}
      </div>

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
                    onChange={(event) => toggleSelectAllOnPage(event.target.checked)}
                    aria-label="Selecionar todas as contas da página"
                  />
                </th>
                <th className="px-4 py-3">
                  <button
                    className="inline-flex items-center gap-2 text-left"
                    type="button"
                    onClick={() => handleSort('name')}
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
                    onClick={() => handleSort('type')}
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
                    onClick={() => handleSort('balance')}
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
              {accountsQuery.isLoading && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center">
                    <p className="text-sm text-muted-foreground">
                      Carregando contas...
                    </p>
                  </td>
                </tr>
              )}
              {accountsQuery.isError && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center">
                    <p className="text-sm text-destructive">
                      Erro ao carregar contas. Tente novamente.
                    </p>
                  </td>
                </tr>
              )}
              {!accountsQuery.isLoading &&
                !accountsQuery.isError &&
                paginatedAccounts.map((account) => {
                  const displayBalance = account.currentBalance ?? 0
                  return (
                    <tr
                      key={account.id}
                      className="cursor-pointer border-t hover:bg-muted/30"
                      onClick={() =>
                        navigate({
                          search: (prev) => ({ ...prev, id: account.id }),
                        })
                      }
                    >
                      <td
                        className="cursor-pointer px-3 py-3"
                        onClick={(event) => {
                          event.stopPropagation()
                          toggleSelectAccount(account.id)
                        }}
                        onMouseDown={(event) => event.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 cursor-pointer"
                          checked={selectedAccountIds.has(account.id)}
                          onChange={(event) =>
                            setAccountSelected(account.id, event.target.checked)
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
              {!accountsQuery.isLoading &&
                !accountsQuery.isError &&
                sortedAccounts.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center">
                      <div className="space-y-2">
                        {accounts.length === 0 ? (
                          <>
                            <p className="text-sm font-medium">
                              Nenhuma conta cadastrada ainda.
                            </p>
                            <Button
                              size="sm"
                              onClick={() => {
                                reset()
                                setIsCreateOpen(true)
                              }}
                            >
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
                    accountsQuery.isLoading || accountsQuery.isError
                      ? 'px-4 py-3 text-right font-semibold text-muted-foreground'
                      : (selectedCount >= 1
                            ? selectedTotal
                            : totalFilteredBalance) < 0
                        ? 'sensitive px-4 py-3 text-right font-semibold text-rose-600'
                        : (selectedCount >= 1
                              ? selectedTotal
                              : totalFilteredBalance) > 0
                          ? 'sensitive px-4 py-3 text-right font-semibold text-emerald-600'
                          : 'sensitive px-4 py-3 text-right font-semibold text-muted-foreground'
                  }
                >
                  {accountsQuery.isLoading || accountsQuery.isError
                    ? '--'
                    : `$ ${formatCurrencyValue(
                        selectedCount >= 1
                          ? selectedTotal
                          : totalFilteredBalance,
                      )}`}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {sortedAccounts.length > pageSize && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Pagina {safePage} de {totalPages}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-[110px]">
              <select
                className="h-11 w-full appearance-none rounded-md border bg-background px-3 pr-10 text-sm sm:h-9"
                value={String(pageSize)}
                onChange={(event) => {
                  const nextSize = Number(event.target.value)
                  setPageSize(nextSize)
                  navigate({
                    search: (prev) => ({
                      ...prev,
                      page: 1,
                    }),
                    replace: false,
                  })
                }}
                aria-label="Quantidade de linhas"
              >
                {[5, 10, 20, 30, 50].map((size) => (
                  <option key={size} value={String(size)}>
                    {size}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground">
                <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
                  <path
                    d="M4 6l4 4 4-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </div>
            <Button
              variant="outline"
              className="h-11 w-full sm:h-9 sm:w-auto"
              disabled={safePage === 1}
              onClick={() =>
                navigate({
                  search: (prev) => ({
                    ...prev,
                    page: 1,
                  }),
                  replace: false,
                })
              }
            >
              Primeira
            </Button>
            <Button
              variant="outline"
              className="h-11 w-full sm:h-9 sm:w-auto"
              disabled={safePage === 1}
              onClick={() =>
                navigate({
                  search: (prev) => ({
                    ...prev,
                    page: safePage - 1,
                  }),
                  replace: false,
                })
              }
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              className="h-11 w-full sm:h-9 sm:w-auto"
              disabled={safePage === totalPages}
              onClick={() =>
                navigate({
                  search: (prev) => ({
                    ...prev,
                    page: safePage + 1,
                  }),
                  replace: false,
                })
              }
            >
              Proxima
            </Button>
            <Button
              variant="outline"
              className="h-11 w-full sm:h-9 sm:w-auto"
              disabled={safePage === totalPages}
              onClick={() =>
                navigate({
                  search: (prev) => ({
                    ...prev,
                    page: totalPages,
                  }),
                  replace: false,
                })
              }
            >
              Ultima
            </Button>
          </div>
        </div>
      )}

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="fixed inset-0"
            onClick={() => setIsCreateOpen(false)}
          />
          <div className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-lg border bg-background p-4 shadow-lg sm:max-h-none sm:overflow-visible sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Criar nova conta</h3>
                <p className="text-sm text-muted-foreground">
                  Preencha os dados básicos para adicionar uma conta.
                </p>
              </div>
            </div>

            <form className="mt-6 space-y-4" onSubmit={submitCreateAccount}>
              <div className="space-y-2">
                <Label htmlFor="account-name">Nome</Label>
                <Input
                  id="account-name"
                  placeholder="Ex: Conta Corrente"
                  className="h-10"
                  aria-invalid={!!errors.name}
                  {...createNameField}
                  ref={(node) => {
                    createNameField.ref(node)
                    createNameRef.current = node
                  }}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">
                    {errors.name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="account-type">Tipo</Label>
                <select
                  id="account-type"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  aria-invalid={!!errors.type}
                  {...register('type')}
                >
                  <option value="">Selecione</option>
                  {ACCOUNT_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {errors.type && (
                  <p className="text-sm text-destructive">
                    {errors.type.message}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-primary sm:h-4 sm:w-4"
                    {...register('confirm')}
                  />
                  Confirmo que os dados estão corretos
                </label>
                <ShortcutTooltip label="Atalho: Ctrl/Cmd+Enter">
                  <Button
                    type="submit"
                    className="w-full sm:w-auto"
                    disabled={!confirmValue || isSubmitting}
                  >
                    {isSubmitting || createAccountMutation.isPending
                      ? 'Criando...'
                      : 'Criar conta'}
                  </Button>
                </ShortcutTooltip>
              </div>
              {errors.confirm && (
                <p className="text-sm text-destructive">
                  {errors.confirm.message}
                </p>
              )}
              {errors.root?.message && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {errors.root.message}
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {selectedAccount && !isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="fixed inset-0"
            onClick={() =>
              navigate({
                search: (prev) => ({ ...prev, id: undefined }),
                replace: true,
              })
            }
          />
          <div
            className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-lg border bg-background p-4 shadow-lg sm:max-h-none sm:overflow-visible sm:p-6"
            ref={detailModalRef}
            tabIndex={-1}
          >
            <div className="space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-semibold">
                  {selectedAccount.name}
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedAccount.isPrimary && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                      Principal
                    </span>
                  )}
                  {selectedAccount.isHiddenOnDashboard && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                      Oculta no dashboard
                    </span>
                  )}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Detalhes da conta</p>
            </div>

            <div className="mt-6 grid gap-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-muted-foreground">Tipo</span>
                <span className="font-medium">
                  {accountTypeLabels[selectedAccount.type] ??
                    selectedAccount.type}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-muted-foreground">Saldo atual</span>
                <span className="sensitive font-semibold">
                  {`$ ${formatCurrencyValue(
                    selectedAccount.currentBalance ?? 0,
                  )}`}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-muted-foreground">Criada em</span>
                <span className="font-medium">
                  {dateFormatter.format(new Date(selectedAccount.createdAt))}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-muted-foreground">Dashboard</span>
                <span className="font-medium">
                  {selectedAccount.isHiddenOnDashboard ? 'Oculta' : 'Visível'}
                </span>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="w-full sm:w-auto">
                <ShortcutTooltip
                  label={
                    selectedAccount.isHiddenOnDashboard
                      ? 'Atalho: M'
                      : 'Atalho: O'
                  }
                >
                  <Button
                    variant={
                      selectedAccount.isHiddenOnDashboard
                        ? 'default'
                        : 'secondary'
                    }
                    className="w-full sm:w-auto"
                    onClick={handleToggleDashboardVisibility}
                    disabled={
                      isTogglingDashboardVisibility || selectedAccount.isPrimary
                    }
                  >
                    {isTogglingDashboardVisibility ? (
                      'Salvando...'
                    ) : selectedAccount.isHiddenOnDashboard ? (
                      <ShortcutLabel label="Mostrar" shortcutIndex={0} />
                    ) : (
                      <ShortcutLabel label="Ocultar" shortcutIndex={0} />
                    )}
                  </Button>
                </ShortcutTooltip>
              </div>
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
                <ShortcutTooltip label="Atalho: R">
                  <Button
                    variant="destructive"
                    className="w-full sm:w-auto"
                    onClick={openAccountDeleteConfirm}
                  >
                    <ShortcutLabel label="Excluir" shortcutIndex={6} />
                  </Button>
                </ShortcutTooltip>
                <ShortcutTooltip label="Atalho: E">
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={openAccountEdit}
                  >
                    <ShortcutLabel label="Editar" shortcutIndex={0} />
                  </Button>
                </ShortcutTooltip>
              </div>
            </div>
            {deleteError && (
              <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {deleteError}
              </div>
            )}
            {dashboardVisibilityError && (
              <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {dashboardVisibilityError}
              </div>
            )}
          </div>
        </div>
      )}

      {isDeleteConfirmOpen && selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="fixed inset-0"
            onClick={() => setIsDeleteConfirmOpen(false)}
          />
          <div
            className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-lg border bg-background p-4 shadow-lg sm:max-h-none sm:overflow-visible sm:p-6"
            ref={deleteModalRef}
            tabIndex={-1}
          >
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Confirmar exclusão</h3>
              <p className="text-sm text-muted-foreground">
                Tem certeza que deseja excluir a conta{' '}
                <span className="font-medium">{selectedAccount.name}</span>?
                Essa ação não pode ser desfeita.
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
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => setIsDeleteConfirmOpen(false)}
                >
                  Cancelar
                </Button>
              </ShortcutTooltip>
              <Button
                variant="destructive"
                className="w-full sm:w-auto"
                disabled={deleteAccountMutation.isPending}
                onClick={async () => {
                  setDeleteBlockedReason(null)
                  setDeleteError(null)
                  try {
                    await deleteAccountMutation.mutateAsync(selectedAccount.id)
                    setIsDeleteConfirmOpen(false)
                    navigate({
                      search: (prev) => ({ ...prev, id: undefined }),
                      replace: true,
                    })
                  } catch (error: unknown) {
                    const status = getApiErrorStatus(error)
                    const message = getApiErrorMessage(error, {
                      defaultMessage: 'Erro ao excluir conta. Tente novamente.',
                    })
                    if (status === 409) {
                      setDeleteError(null)
                      setDeleteBlockedReason(
                        isRecurrenceConflictMessage(message)
                          ? `${message} Finalize ou remapeie as recorrências antes de excluir a conta.`
                          : message,
                      )
                    } else {
                      setDeleteBlockedReason(null)
                      setDeleteError(message)
                    }
                  }
                }}
              >
                {deleteAccountMutation.isPending
                  ? 'Excluindo...'
                  : 'Confirmar exclusão'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {isEditOpen && selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="fixed inset-0"
            onClick={() => {
              setIsEditOpen(false)
              navigate({
                search: (prev) => ({ ...prev, id: undefined }),
                replace: true,
              })
            }}
          />
          <div className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-lg border bg-background p-4 shadow-lg sm:max-h-none sm:overflow-visible sm:p-6">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">Editar conta</h3>
              <p className="text-sm text-muted-foreground">
                Atualize as informações da conta selecionada.
              </p>
            </div>

            <form className="mt-6 space-y-4" onSubmit={submitEditAccount}>
              <div className="space-y-2">
                <Label htmlFor="edit-account-name">Nome</Label>
                <Input
                  id="edit-account-name"
                  placeholder="Ex: Conta Corrente"
                  className="h-10"
                  aria-invalid={!!editErrors.name}
                  {...editNameField}
                  ref={(node) => {
                    editNameField.ref(node)
                    editNameRef.current = node
                  }}
                />
                {editErrors.name && (
                  <p className="text-sm text-destructive">
                    {editErrors.name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-account-type">Tipo</Label>
                <select
                  id="edit-account-type"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  aria-invalid={!!editErrors.type}
                  {...editRegister('type')}
                >
                  <option value="">Selecione</option>
                  {ACCOUNT_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {editErrors.type && (
                  <p className="text-sm text-destructive">
                    {editErrors.type.message}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-primary sm:h-4 sm:w-4"
                    {...editRegister('confirm')}
                  />
                  Confirmo que os dados estão corretos
                </label>
                <ShortcutTooltip label="Atalho: Ctrl/Cmd+Enter">
                  <Button
                    type="submit"
                    className="w-full sm:w-auto"
                    disabled={!confirmEditValue || isEditSubmitting}
                  >
                    {isEditSubmitting || updateAccountMutation.isPending
                      ? 'Salvando...'
                      : 'Salvar alterações'}
                  </Button>
                </ShortcutTooltip>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <ShortcutTooltip label="Atalho: Ctrl/Cmd+P">
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full sm:w-auto"
                    onClick={openPrimaryConfirm}
                    disabled={selectedAccount.isPrimary || isSettingPrimary}
                  >
                    {selectedAccount.isPrimary
                      ? 'Conta principal'
                      : isSettingPrimary
                        ? 'Definindo...'
                        : 'Definir como principal'}
                  </Button>
                </ShortcutTooltip>
                {selectedAccount.isPrimary && (
                  <span className="text-xs font-semibold text-emerald-600">
                    Principal ativa
                  </span>
                )}
              </div>
              {editErrors.confirm && (
                <p className="text-sm text-destructive">
                  {editErrors.confirm.message}
                </p>
              )}
              {editErrors.root?.message && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {editErrors.root.message}
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {isPrimaryConfirmOpen && selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="fixed inset-0"
            onClick={closePrimaryConfirm}
          />
          <div className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-lg border bg-background p-4 shadow-lg sm:max-h-none sm:overflow-visible sm:p-6">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Definir conta principal</h3>
              <p className="text-sm text-muted-foreground">
                Deseja definir a conta {selectedAccount.name} como principal?
              </p>
            </div>

            {primaryError && (
              <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {primaryError}
              </div>
            )}

            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <ShortcutTooltip label="Atalho: Esc">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={closePrimaryConfirm}
                  disabled={isSettingPrimary}
                >
                  Cancelar
                </Button>
              </ShortcutTooltip>
              <Button
                className="w-full sm:w-auto"
                onClick={handleSetPrimaryAccount}
                disabled={isSettingPrimary}
              >
                {isSettingPrimary ? 'Definindo...' : 'Confirmar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
