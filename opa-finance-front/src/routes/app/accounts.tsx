import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute } from '@tanstack/react-router'
import { SlidersHorizontal } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  useAccounts,
  useCreateAccount,
  useDeleteAccount,
  useUpdateAccount,
} from '@/features/accounts'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatCurrencyValue } from '@/lib/utils'
import {
  accountCreateSchema,
  accountUpdateSchema,
  type AccountCreateFormData,
  type AccountUpdateFormData,
} from '@/schemas/account.schema'

export const Route = createFileRoute('/app/accounts')({
  validateSearch: z.object({
    q: z.string().optional(),
    type: z
      .preprocess(
        (value) => {
          const allowed = [
            'cash',
            'checking_account',
            'savings_account',
            'credit_card',
            'investment',
          ]
          if (typeof value !== 'string') {
            return undefined
          }
          return allowed.includes(value) ? value : undefined
        },
        z.enum([
          'cash',
          'checking_account',
          'savings_account',
          'credit_card',
          'investment',
        ]),
      )
      .optional(),
    id: z.string().optional(),
    sort: z
      .preprocess(
        (value) => {
          const allowed = ['name', 'type', 'balance']
          if (typeof value !== 'string') {
            return undefined
          }
          return allowed.includes(value) ? value : undefined
        },
        z.enum(['name', 'type', 'balance']),
      )
      .optional(),
    dir: z
      .preprocess(
        (value) => {
          const allowed = ['asc', 'desc']
          if (typeof value !== 'string') {
            return undefined
          }
          return allowed.includes(value) ? value : undefined
        },
        z.enum(['asc', 'desc']),
      )
      .optional(),
    page: z
      .preprocess(
        (value) => {
          const parsed = Number(value)
          if (!Number.isFinite(parsed) || parsed < 1) {
            return undefined
          }
          return Math.floor(parsed)
        },
        z.number().int().min(1),
      )
      .optional(),
  }),
  component: Accounts,
})

function Accounts() {
  const navigate = Route.useNavigate()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteBlockedReason, setDeleteBlockedReason] = useState<string | null>(
    null,
  )
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(
    new Set(),
  )
  const ignoreSearchSyncRef = useRef(false)
  const ignoreDebouncedSearchRef = useRef(false)
  const createNameRef = useRef<HTMLInputElement | null>(null)
  const editNameRef = useRef<HTMLInputElement | null>(null)
  const detailModalRef = useRef<HTMLDivElement | null>(null)
  const deleteModalRef = useRef<HTMLDivElement | null>(null)
  const selectAllRef = useRef<HTMLInputElement | null>(null)

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
    formState: {
      errors: editErrors,
      isSubmitting: isEditSubmitting,
    },
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
  const accounts = accountsQuery.data ?? []
  const isRefreshingAccounts =
    accountsQuery.isFetching && !accountsQuery.isLoading
  const search = Route.useSearch()
  const searchTerm = search.q ?? ''
  const [searchDraft, setSearchDraft] = useState(searchTerm)
  const debouncedSearch = useDebouncedValue(searchDraft, 300)
  const typeFilter = search.type ?? ''
  const selectedAccountId = search.id ?? null
  const sortKey = search.sort ?? null
  const sortDirection = search.dir ?? 'asc'
  const currentPage = search.page ?? 1
  const selectedAccount = accounts.find(
    (account) => account.id === selectedAccountId,
  )
  const accountTypeLabels: Record<string, string> = {
    cash: 'Dinheiro',
    checking_account: 'Conta Corrente',
    savings_account: 'Poupança',
    credit_card: 'Cartão de Crédito',
    investment: 'Investimento',
  }
  const hasActiveFilters = searchDraft.trim() !== '' || typeFilter !== ''
  const normalizedSearch = normalizeSearch(searchTerm)
  const filteredAccounts = accounts.filter((account) => {
    const matchesName = normalizedSearch
      ? normalizeSearch(account.name).includes(normalizedSearch)
      : true
    const matchesType = typeFilter ? account.type === typeFilter : true
    return matchesName && matchesType
  })
  const totalFilteredBalance = filteredAccounts.reduce(
    (total, account) => total + (account.currentBalance ?? 0),
    0,
  )
  const sortedAccounts = [...filteredAccounts].sort((a, b) => {
    if (!sortKey) {
      return 0
    }

    const directionMultiplier = sortDirection === 'asc' ? 1 : -1

    if (sortKey === 'balance') {
      const balanceA = a.currentBalance ?? 0
      const balanceB = b.currentBalance ?? 0
      return (balanceA - balanceB) * directionMultiplier
    }

    if (sortKey === 'type') {
      const labelA = accountTypeLabels[a.type] ?? a.type
      const labelB = accountTypeLabels[b.type] ?? b.type
      return labelA.localeCompare(labelB) * directionMultiplier
    }

    return a.name.localeCompare(b.name) * directionMultiplier
  })

  function handleSort(nextKey: 'name' | 'type' | 'balance') {
    navigate({
      search: (prev) => {
        const isSame = prev.sort === nextKey
        const nextDirection =
          isSame && prev.dir === 'asc' ? 'desc' : 'asc'
        return {
          ...prev,
          sort: nextKey,
          dir: nextDirection,
        }
      },
      replace: false,
    })
  }

  const pageSize = 10
  const totalPages = Math.max(1, Math.ceil(sortedAccounts.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedAccounts =
    sortedAccounts.length > pageSize
      ? sortedAccounts.slice((safePage - 1) * pageSize, safePage * pageSize)
      : sortedAccounts
  const selectedAccounts = filteredAccounts.filter((account) =>
    selectedAccountIds.has(account.id),
  )
  const selectedCount = selectedAccounts.length
  const selectedTotal = selectedAccounts.reduce(
    (total, account) => total + (account.currentBalance ?? 0),
    0,
  )
  const pageIds = paginatedAccounts.map((account) => account.id)
  const selectedOnPageCount = pageIds.filter((id) =>
    selectedAccountIds.has(id),
  ).length
  const allSelectedOnPage =
    pageIds.length > 0 && selectedOnPageCount === pageIds.length
  const hasSelectionOnPage = selectedOnPageCount > 0

  const deleteAccountMutation = useDeleteAccount()

  useEffect(() => {
    setDeleteError(null)
    setDeleteBlockedReason(null)
  }, [selectedAccountId])

  useEffect(() => {
    const nextPage =
      totalPages > 0 ? Math.min(currentPage, totalPages) : currentPage

    if (selectedAccountId && !accountsQuery.isLoading && !selectedAccount) {
      navigate({
        search: (prev) => ({ ...prev, id: undefined }),
        replace: true,
      })
      return
    }

    if (nextPage !== currentPage) {
      navigate({
        search: (prev) => ({ ...prev, page: nextPage }),
        replace: true,
      })
    }
  }, [
    accountsQuery.isLoading,
    currentPage,
    navigate,
    selectedAccount,
    selectedAccountId,
    totalPages,
  ])

  useEffect(() => {
    const hasOpenModal =
      isCreateOpen || isEditOpen || isDeleteConfirmOpen || !!selectedAccount
    if (!hasOpenModal) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isCreateOpen, isEditOpen, isDeleteConfirmOpen, selectedAccount])

  useEffect(() => {
    if (ignoreSearchSyncRef.current) {
      ignoreSearchSyncRef.current = false
      return
    }
    setSearchDraft(searchTerm)
  }, [searchTerm])

  useEffect(() => {
    setSelectedAccountIds(new Set())
  }, [normalizedSearch, typeFilter])

  useEffect(() => {
    if (!selectAllRef.current) {
      return
    }
    selectAllRef.current.indeterminate =
      hasSelectionOnPage && !allSelectedOnPage
  }, [allSelectedOnPage, hasSelectionOnPage])

  useEffect(() => {
    setSelectedAccountIds((prev) => {
      if (prev.size === 0) {
        return prev
      }
      const validIds = new Set(accounts.map((account) => account.id))
      const next = new Set([...prev].filter((id) => validIds.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [accounts])

  useEffect(() => {
    const hasOpenModal =
      isCreateOpen || isEditOpen || isDeleteConfirmOpen || !!selectedAccount
    if (hasOpenModal || selectedAccountIds.size === 0) {
      return
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }
      setSelectedAccountIds(new Set())
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [
    isCreateOpen,
    isEditOpen,
    isDeleteConfirmOpen,
    selectedAccount,
    selectedAccountIds.size,
  ])

  useEffect(() => {
    if (ignoreDebouncedSearchRef.current) {
      ignoreDebouncedSearchRef.current = false
      return
    }
    if (debouncedSearch === searchTerm) {
      return
    }
    const trimmedValue = debouncedSearch.trim()
    navigate({
      search: (prev) => ({
        ...prev,
        q: trimmedValue ? trimmedValue : undefined,
      }),
      replace: true,
    })
  }, [debouncedSearch, navigate, searchTerm])

  useEffect(() => {
    if (!isCreateOpen) {
      return
    }
    createNameRef.current?.focus()
  }, [isCreateOpen])

  useEffect(() => {
    if (!isEditOpen) {
      return
    }
    editNameRef.current?.focus()
  }, [isEditOpen])

  useEffect(() => {
    if (isDeleteConfirmOpen) {
      deleteModalRef.current?.focus()
      return
    }
    if (selectedAccount && !isEditOpen) {
      detailModalRef.current?.focus()
    }
  }, [isDeleteConfirmOpen, isEditOpen, selectedAccount])

  useEffect(() => {
    const hasOpenModal =
      isCreateOpen || isEditOpen || isDeleteConfirmOpen || !!selectedAccount
    if (!hasOpenModal) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') {
        return
      }

      if (isDeleteConfirmOpen) {
        setIsDeleteConfirmOpen(false)
        return
      }

      if (isEditOpen) {
        setIsEditOpen(false)
        navigate({
          search: (prev) => ({ ...prev, id: undefined }),
          replace: true,
        })
        return
      }

      if (isCreateOpen) {
        setIsCreateOpen(false)
        return
      }

      if (selectedAccount) {
        navigate({
          search: (prev) => ({ ...prev, id: undefined }),
          replace: true,
        })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isCreateOpen, isEditOpen, isDeleteConfirmOpen, selectedAccount, navigate])

  function getErrorStatus(error: unknown) {
    if (!error || typeof error !== 'object' || !('response' in error)) {
      return undefined
    }
    const response = (error as { response?: { status?: number } }).response
    return response?.status
  }

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
            variant={hasActiveFilters || isFiltersOpen ? 'secondary' : 'outline'}
            size="icon"
            className="h-10 w-10 sm:hidden"
            aria-label={isFiltersOpen ? 'Ocultar filtros' : 'Mostrar filtros'}
            onClick={() => setIsFiltersOpen((prev) => !prev)}
          >
            <SlidersHorizontal className="size-4" />
          </Button>
          <Button
            onClick={() => {
              reset()
              setIsCreateOpen(true)
            }}
          >
            Nova conta
          </Button>
        </div>
      </div>

      <div
        className={`rounded-lg border bg-card p-4 ${isFiltersOpen ? 'block' : 'hidden'
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
                  const trimmedValue = event.currentTarget.value.trim()
                  setSearchDraft(event.currentTarget.value)
                  navigate({
                    search: (prev) => ({
                      ...prev,
                      q: trimmedValue ? trimmedValue : undefined,
                    }),
                    replace: false,
                  })
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
                      navigate({
                        search: (prev) => ({
                          ...prev,
                          type: event.target.value || undefined,
                        }),
                        replace: false,
                      })
                    }
                  >
                    <option value="">Todos</option>
                    <option value="credit_card">Cartão de Crédito</option>
                    <option value="checking_account">Conta Corrente</option>
                    <option value="cash">Dinheiro</option>
                    <option value="investment">Investimento</option>
                    <option value="savings_account">Poupança</option>
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
                  onClick={() => {
                    ignoreSearchSyncRef.current = true
                    ignoreDebouncedSearchRef.current = true
                    setSearchDraft('')
                    navigate({
                      search: () => ({}),
                      replace: false,
                    })
                  }}
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
              onChange={(event) => {
                setSelectedAccountIds((prev) => {
                  const next = new Set(prev)
                  if (event.target.checked) {
                    pageIds.forEach((id) => next.add(id))
                  } else {
                    pageIds.forEach((id) => next.delete(id))
                  }
                  return next
                })
              }}
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
            const balanceClass =
              displayBalance < 0
                ? 'text-rose-600'
                : displayBalance > 0
                  ? 'text-emerald-600'
                  : 'text-muted-foreground'
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
                    <p className="text-sm font-semibold">{account.name}</p>
                  </div>
                  <input
                    type="checkbox"
                    className="h-5 w-5 cursor-pointer"
                    checked={selectedAccountIds.has(account.id)}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => {
                      setSelectedAccountIds((prev) => {
                        const next = new Set(prev)
                        if (event.target.checked) {
                          next.add(account.id)
                        } else {
                          next.delete(account.id)
                        }
                        return next
                      })
                    }}
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
                    <p className={`sensitive text-sm font-semibold ${balanceClass}`}>
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
                <span
                  className={
                    (selectedCount >= 1
                      ? selectedTotal
                      : totalFilteredBalance) < 0
                      ? 'sensitive font-semibold text-rose-600'
                      : (selectedCount >= 1
                        ? selectedTotal
                        : totalFilteredBalance) > 0
                        ? 'sensitive font-semibold text-emerald-600'
                        : 'sensitive font-semibold text-muted-foreground'
                  }
                >
                  {`$ ${formatCurrencyValue(
                    selectedCount >= 1
                      ? selectedTotal
                      : totalFilteredBalance,
                  )}`}
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
                    onChange={(event) => {
                      setSelectedAccountIds((prev) => {
                        const next = new Set(prev)
                        if (event.target.checked) {
                          pageIds.forEach((id) => next.add(id))
                        } else {
                          pageIds.forEach((id) => next.delete(id))
                        }
                        return next
                      })
                    }}
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
                    <SortIcon
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
                    <SortIcon
                      isActive={sortKey === 'type'}
                      direction={sortDirection}
                    />
                  </button>
                </th>
                <th
                  className={`w-[1%] px-4 py-3 text-right whitespace-nowrap ${isRefreshingAccounts ? 'text-emerald-600' : ''
                    }`}
                >
                  <button
                    className="inline-flex items-center gap-2 text-right"
                    type="button"
                    onClick={() => handleSort('balance')}
                  >
                    Saldo atual
                    <SortIcon
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
                          setSelectedAccountIds((prev) => {
                            const next = new Set(prev)
                            if (next.has(account.id)) {
                              next.delete(account.id)
                            } else {
                              next.add(account.id)
                            }
                            return next
                          })
                        }}
                        onMouseDown={(event) => event.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 cursor-pointer"
                          checked={selectedAccountIds.has(account.id)}
                          onChange={(event) => {
                            setSelectedAccountIds((prev) => {
                              const next = new Set(prev)
                              if (event.target.checked) {
                                next.add(account.id)
                              } else {
                                next.delete(account.id)
                              }
                              return next
                            })
                          }}
                          aria-label={`Selecionar conta ${account.name}`}
                        />
                      </td>
                      <td className="px-4 py-3 font-medium">{account.name}</td>
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

            <form
              className="mt-6 space-y-4"
              onSubmit={handleSubmit(async (formData) => {
                try {
                  await createAccountMutation.mutateAsync({
                    name: formData.name,
                    type: formData.type,
                  })
                  setIsCreateOpen(false)
                  reset()
                } catch (error: unknown) {
                  setError('root', {
                    message: getApiErrorMessage(error, {
                      defaultMessage:
                        'Erro ao criar conta. Tente novamente.',
                    }),
                  })
                }
              })}
            >
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
                  <option value="credit_card">Cartão de Crédito</option>
                  <option value="checking_account">Conta Corrente</option>
                  <option value="cash">Dinheiro</option>
                  <option value="investment">Investimento</option>
                  <option value="savings_account">Poupança</option>
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
                <Button
                  type="submit"
                  className="w-full sm:w-auto"
                  disabled={!confirmValue || isSubmitting}
                >
                  {isSubmitting || createAccountMutation.isPending
                    ? 'Criando...'
                    : 'Criar conta'}
                </Button>
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
              <h3 className="text-lg font-semibold">{selectedAccount.name}</h3>
              <p className="text-sm text-muted-foreground">
                Detalhes da conta
              </p>
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
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
                <Button
                  variant="destructive"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    setDeleteBlockedReason(null)
                    setDeleteError(null)
                    setIsDeleteConfirmOpen(true)
                  }}
                >
                  Excluir
                </Button>
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    resetEdit({
                      name: selectedAccount.name,
                      type: selectedAccount.type,
                      confirm: false,
                    })
                    setIsEditOpen(true)
                  }}
                >
                  Editar
                </Button>
              </div>
            </div>
            {deleteError && (
              <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {deleteError}
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
              <h3 className="text-lg font-semibold">
                Confirmar exclusão
              </h3>
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

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => setIsDeleteConfirmOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                className="w-full sm:w-auto"
                disabled={deleteAccountMutation.isPending}
                onClick={async () => {
                  try {
                    await deleteAccountMutation.mutateAsync(
                      selectedAccount.id,
                    )
                    setIsDeleteConfirmOpen(false)
                    navigate({
                      search: (prev) => ({ ...prev, id: undefined }),
                      replace: true,
                    })
                    setDeleteError(null)
                  } catch (error: unknown) {
                    const status = getErrorStatus(error)
                    if (status === 409) {
                      setDeleteBlockedReason(
                        'Conta possui transações e não pode ser removida.',
                      )
                    } else {
                      setDeleteError(
                        getApiErrorMessage(error, {
                          defaultMessage:
                            'Erro ao excluir conta. Tente novamente.',
                        }),
                      )
                    }
                    setIsDeleteConfirmOpen(false)
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

            <form
              className="mt-6 space-y-4"
              onSubmit={handleEditSubmit(async (formData) => {
                try {
                  await updateAccountMutation.mutateAsync({
                    id: selectedAccount.id,
                    payload: {
                      name: formData.name,
                      type: formData.type,
                    },
                  })
                  setIsEditOpen(false)
                  navigate({
                    search: (prev) => ({ ...prev, id: undefined }),
                    replace: true,
                  })
                  resetEdit()
                } catch (error: unknown) {
                  setEditError('root', {
                    message: getApiErrorMessage(error, {
                      defaultMessage:
                        'Erro ao atualizar conta. Tente novamente.',
                    }),
                  })
                }
              })}
            >
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
                  <option value="credit_card">Cartão de Crédito</option>
                  <option value="checking_account">Conta Corrente</option>
                  <option value="cash">Dinheiro</option>
                  <option value="investment">Investimento</option>
                  <option value="savings_account">Poupança</option>
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
                <Button
                  type="submit"
                  className="w-full sm:w-auto"
                  disabled={!confirmEditValue || isEditSubmitting}
                >
                  {isEditSubmitting || updateAccountMutation.isPending
                    ? 'Salvando...'
                    : 'Salvar alterações'}
                </Button>
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
    </div>
  )
}

function normalizeSearch(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedValue(value)
    }, delayMs)
    return () => window.clearTimeout(timeoutId)
  }, [value, delayMs])

  return debouncedValue
}

function SortIcon({
  isActive,
  direction,
}: {
  isActive: boolean
  direction: 'asc' | 'desc'
}) {
  if (!isActive) {
    return (
      <span className="text-muted-foreground">
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
          <path
            d="M5 3l3-3 3 3M11 13l-3 3-3-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    )
  }

  return (
    <span className="text-foreground">
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
        <path
          d={direction === 'asc' ? 'M4 10l4-4 4 4' : 'M4 6l4 4 4-4'}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}
