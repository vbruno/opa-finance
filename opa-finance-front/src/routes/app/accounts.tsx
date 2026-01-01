import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getApiErrorMessage } from '@/lib/apiError'
import {
  useAccounts,
  useCreateAccount,
  useDeleteAccount,
  useUpdateAccount,
  type Account,
} from '@/features/accounts/accounts.api'
import {
  formatCurrencyInput,
  formatCurrencyValue,
  parseCurrencyInput,
} from '@/lib/utils'
import {
  accountCreateSchema,
  type AccountCreateFormData,
} from '@/schemas/account.schema'

export const Route = createFileRoute('/app/accounts')({
  validateSearch: z.object({
    q: z.string().optional(),
    type: z.preprocess(
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
      z
        .enum([
          'cash',
          'checking_account',
          'savings_account',
          'credit_card',
          'investment',
        ])
        .optional(),
    ),
    id: z.string().optional(),
    sort: z.preprocess(
      (value) => {
        const allowed = ['name', 'type', 'balance']
        if (typeof value !== 'string') {
          return undefined
        }
        return allowed.includes(value) ? value : undefined
      },
      z.enum(['name', 'type', 'balance']).optional(),
    ),
    dir: z.preprocess(
      (value) => {
        const allowed = ['asc', 'desc']
        if (typeof value !== 'string') {
          return undefined
        }
        return allowed.includes(value) ? value : undefined
      },
      z.enum(['asc', 'desc']).optional(),
    ),
    page: z.preprocess(
      (value) => {
        const parsed = Number(value)
        if (!Number.isFinite(parsed) || parsed < 1) {
          return undefined
        }
        return Math.floor(parsed)
      },
      z.number().int().min(1).optional(),
    ),
  }),
  component: Accounts,
})

function Accounts() {
  const navigate = useNavigate()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteBlockedReason, setDeleteBlockedReason] = useState<string | null>(
    null,
  )
  const createNameRef = useRef<HTMLInputElement | null>(null)
  const editNameRef = useRef<HTMLInputElement | null>(null)
  const detailModalRef = useRef<HTMLDivElement | null>(null)
  const deleteModalRef = useRef<HTMLDivElement | null>(null)

  const {
    control,
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
      currentBalance: '',
      confirm: false,
    },
  })

  const confirmValue = watch('confirm')

  const {
    control: editControl,
    register: editRegister,
    handleSubmit: handleEditSubmit,
    reset: resetEdit,
    watch: watchEdit,
    setError: setEditError,
    formState: {
      errors: editErrors,
      isSubmitting: isEditSubmitting,
    },
  } = useForm<AccountCreateFormData>({
    resolver: zodResolver(accountCreateSchema),
    defaultValues: {
      name: '',
      type: undefined,
      currentBalance: '',
      confirm: false,
    },
  })

  const confirmEditValue = watchEdit('confirm')

  const accountsQuery = useAccounts()

  const createAccountMutation = useCreateAccount()

  const updateAccountMutation = useUpdateAccount()

  const dateFormatter = new Intl.DateTimeFormat('pt-BR')
  const accounts = accountsQuery.data ?? []
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
    savings_account: 'Poupanca',
    credit_card: 'Cartao de Credito',
    investment: 'Investimento',
  }
  const hasActiveFilters = searchTerm.trim() !== '' || typeFilter !== ''
  const normalizedSearch = normalizeSearch(searchTerm)
  const filteredAccounts = accounts.filter((account) => {
    const matchesName = normalizedSearch
      ? normalizeSearch(account.name).includes(normalizedSearch)
      : true
    const matchesType = typeFilter ? account.type === typeFilter : true
    return matchesName && matchesType
  })
  const sortedAccounts = [...filteredAccounts].sort((a, b) => {
    if (!sortKey) {
      return 0
    }

    const directionMultiplier = sortDirection === 'asc' ? 1 : -1

    if (sortKey === 'balance') {
      const balanceA = a.currentBalance ?? a.initialBalance ?? 0
      const balanceB = b.currentBalance ?? b.initialBalance ?? 0
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
    setSearchDraft(searchTerm)
  }, [searchTerm])

  useEffect(() => {
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Contas</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie suas contas e acompanhe os saldos atuais.
          </p>
        </div>

        <div className="flex items-center gap-2">
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

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-background p-4">
        <div className="flex-1">
          <label className="text-xs font-semibold uppercase text-muted-foreground">
            Buscar
          </label>
          <Input
            type="text"
            placeholder="Buscar por nome..."
            className="mt-2 h-10"
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
        <div className="w-full sm:w-56">
          <label className="text-xs font-semibold uppercase text-muted-foreground">
            Tipo
          </label>
          <div className="relative mt-2">
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
              <option value="checking_account">Conta Corrente</option>
              <option value="savings_account">Poupanca</option>
              <option value="credit_card">Cartao de Credito</option>
              <option value="investment">Investimento</option>
              <option value="cash">Dinheiro</option>
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
        <div className="flex h-10 items-end">
          <Button
            variant="outline"
            size="icon"
            disabled={!hasActiveFilters}
            aria-label="Limpar filtros"
            className="h-10 w-10"
            onClick={() => {
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

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">
                <button
                  className="inline-flex items-center gap-2 text-left"
                  type="button"
                  onClick={() => handleSort('name')}
                >
                  Conta
                  <SortIcon isActive={sortKey === 'name'} direction={sortDirection} />
                </button>
              </th>
              <th className="w-[1%] px-4 py-3 whitespace-nowrap">
                <button
                  className="inline-flex items-center gap-2 text-left"
                  type="button"
                  onClick={() => handleSort('type')}
                >
                  Tipo
                  <SortIcon isActive={sortKey === 'type'} direction={sortDirection} />
                </button>
              </th>
              <th className="w-[1%] px-4 py-3 text-right whitespace-nowrap">
                <button
                  className="inline-flex items-center gap-2 text-right"
                  type="button"
                  onClick={() => handleSort('balance')}
                >
                  Saldo atual
                  <SortIcon isActive={sortKey === 'balance'} direction={sortDirection} />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {accountsQuery.isLoading && (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center">
                  <p className="text-sm text-muted-foreground">
                    Carregando contas...
                  </p>
                </td>
              </tr>
            )}
            {accountsQuery.isError && (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center">
                  <p className="text-sm text-destructive">
                    Erro ao carregar contas. Tente novamente.
                  </p>
                </td>
              </tr>
            )}
            {!accountsQuery.isLoading &&
              !accountsQuery.isError &&
              paginatedAccounts.map((account) => {
                const displayBalance =
                  account.currentBalance ?? account.initialBalance ?? 0
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
                    <td className="px-4 py-3 font-medium">{account.name}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {accountTypeLabels[account.type] ?? account.type}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                      {`$ ${formatCurrencyValue(displayBalance)}`}
                    </td>
                  </tr>
                )
              })}
            {!accountsQuery.isLoading &&
              !accountsQuery.isError &&
              sortedAccounts.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center">
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
        </table>
      </div>

      {sortedAccounts.length > pageSize && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Pagina {safePage} de {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
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
          <div className="relative w-full max-w-lg rounded-lg border bg-background p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Criar nova conta</h3>
                <p className="text-sm text-muted-foreground">
                  Preencha os dados basicos para adicionar uma conta.
                </p>
              </div>
            </div>

            <form
              className="mt-6 space-y-4"
              onSubmit={handleSubmit(async (formData) => {
                try {
                  const parsedBalance =
                    parseCurrencyInput(formData.currentBalance) ?? 0
                  await createAccountMutation.mutateAsync({
                    name: formData.name,
                    type: formData.type,
                    initialBalance: parsedBalance,
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
                  ref={createNameRef}
                  aria-invalid={!!errors.name}
                  {...register('name')}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">
                    {errors.name.message}
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="account-type">Tipo</Label>
                  <select
                    id="account-type"
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    aria-invalid={!!errors.type}
                    {...register('type')}
                  >
                    <option value="">Selecione</option>
                    <option value="checking_account">Conta Corrente</option>
                    <option value="savings_account">Poupanca</option>
                    <option value="credit_card">Cartao de Credito</option>
                    <option value="investment">Investimento</option>
                    <option value="cash">Dinheiro</option>
                  </select>
                  {errors.type && (
                    <p className="text-sm text-destructive">
                      {errors.type.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="account-balance">Saldo atual</Label>
                  <Controller
                    control={control}
                    name="currentBalance"
                    render={({ field }) => (
                      <Input
                        id="account-balance"
                        type="text"
                        inputMode="numeric"
                        placeholder="$ 0,00"
                        value={field.value}
                        onChange={(event) =>
                          field.onChange(
                            formatCurrencyInput(event.target.value),
                          )
                        }
                        className="h-10"
                        aria-invalid={!!errors.currentBalance}
                      />
                    )}
                  />
                  {errors.currentBalance && (
                    <p className="text-sm text-destructive">
                      {errors.currentBalance.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    {...register('confirm')}
                  />
                  Confirmo que os dados estao corretos
                </label>
                <Button type="submit" disabled={!confirmValue || isSubmitting}>
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
            className="relative w-full max-w-lg rounded-lg border bg-background p-6 shadow-lg"
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
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Tipo</span>
                <span className="font-medium">
                  {accountTypeLabels[selectedAccount.type] ??
                    selectedAccount.type}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Saldo atual</span>
                <span className="font-semibold">
                  {`$ ${formatCurrencyValue(
                    selectedAccount.currentBalance ??
                    selectedAccount.initialBalance ??
                    0,
                  )}`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Criada em</span>
                <span className="font-medium">
                  {dateFormatter.format(new Date(selectedAccount.createdAt))}
                </span>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="destructive"
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
                  onClick={() => {
                    const displayBalance =
                      selectedAccount.currentBalance ??
                      selectedAccount.initialBalance ??
                      0
                    resetEdit({
                      name: selectedAccount.name,
                      type: selectedAccount.type,
                      currentBalance: `$ ${formatCurrencyValue(displayBalance)}`,
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
            className="relative w-full max-w-md rounded-lg border bg-background p-6 shadow-lg"
            ref={deleteModalRef}
            tabIndex={-1}
          >
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">
                Confirmar exclusao
              </h3>
              <p className="text-sm text-muted-foreground">
                Tem certeza que deseja excluir a conta{' '}
                <span className="font-medium">{selectedAccount.name}</span>?
                Essa acao nao pode ser desfeita.
              </p>
            </div>
            {deleteBlockedReason && (
              <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {deleteBlockedReason}
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsDeleteConfirmOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
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
                        'Conta possui transacoes e nao pode ser removida.',
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
                  : 'Confirmar exclusao'}
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
          <div className="relative w-full max-w-lg rounded-lg border bg-background p-6 shadow-lg">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">Editar conta</h3>
              <p className="text-sm text-muted-foreground">
                Atualize as informacoes da conta selecionada.
              </p>
            </div>

            <form
              className="mt-6 space-y-4"
              onSubmit={handleEditSubmit(async (formData) => {
                try {
                  const parsedBalance =
                    parseCurrencyInput(formData.currentBalance) ?? 0
                  await updateAccountMutation.mutateAsync({
                    id: selectedAccount.id,
                    payload: {
                      name: formData.name,
                      type: formData.type,
                      initialBalance: parsedBalance,
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
                  ref={editNameRef}
                  aria-invalid={!!editErrors.name}
                  {...editRegister('name')}
                />
                {editErrors.name && (
                  <p className="text-sm text-destructive">
                    {editErrors.name.message}
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-account-type">Tipo</Label>
                  <select
                    id="edit-account-type"
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    aria-invalid={!!editErrors.type}
                    {...editRegister('type')}
                  >
                    <option value="">Selecione</option>
                    <option value="checking_account">Conta Corrente</option>
                    <option value="savings_account">Poupanca</option>
                    <option value="credit_card">Cartao de Credito</option>
                    <option value="investment">Investimento</option>
                    <option value="cash">Dinheiro</option>
                  </select>
                  {editErrors.type && (
                    <p className="text-sm text-destructive">
                      {editErrors.type.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-account-balance">Saldo atual</Label>
                  <Controller
                    control={editControl}
                    name="currentBalance"
                    render={({ field }) => (
                      <Input
                        id="edit-account-balance"
                        type="text"
                        inputMode="numeric"
                        placeholder="$ 0,00"
                        value={field.value}
                        onChange={(event) =>
                          field.onChange(
                            formatCurrencyInput(event.target.value),
                          )
                        }
                        className="h-10"
                        aria-invalid={!!editErrors.currentBalance}
                      />
                    )}
                  />
                  {editErrors.currentBalance && (
                    <p className="text-sm text-destructive">
                      {editErrors.currentBalance.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    {...editRegister('confirm')}
                  />
                  Confirmo que os dados estao corretos
                </label>
                <Button
                  type="submit"
                  disabled={!confirmEditValue || isEditSubmitting}
                >
                  {isEditSubmitting || updateAccountMutation.isPending
                    ? 'Salvando...'
                    : 'Salvar alteracoes'}
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
