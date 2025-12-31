import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { getApiErrorMessage } from '@/lib/apiError'
import {
  formatCurrencyInput,
  formatCurrencyValue,
  parseCurrencyInput,
} from '@/lib/utils'
import {
  transactionCreateSchema,
  type TransactionCreateFormData,
} from '@/schemas/transaction.schema'
import {
  useCreateTransaction,
  useDeleteTransaction,
  useTransactions,
  useUpdateTransaction,
  type Transaction,
} from '@/transactions/transactions.api'

export const Route = createFileRoute('/app/transactions')({
  validateSearch: z.object({
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
    type: z.preprocess(
      (value) => {
        const allowed = ['income', 'expense']
        if (typeof value !== 'string') {
          return undefined
        }
        return allowed.includes(value) ? value : undefined
      },
      z.enum(['income', 'expense']).optional(),
    ),
    accountId: z.string().optional(),
    categoryId: z.string().optional(),
    subcategoryId: z.string().optional(),
    description: z.string().optional(),
    includeNotes: z.preprocess(
      (value) => {
        if (value === 'true' || value === '1') {
          return true
        }
        if (value === 'false' || value === '0') {
          return false
        }
        return undefined
      },
      z.boolean().optional(),
    ),
    sort: z.preprocess(
      (value) => {
        const allowed = [
          'date',
          'description',
          'account',
          'category',
          'subcategory',
          'type',
          'amount',
        ]
        if (typeof value !== 'string') {
          return undefined
        }
        return allowed.includes(value) ? value : undefined
      },
      z
        .enum([
          'date',
          'description',
          'account',
          'category',
          'subcategory',
          'type',
          'amount',
        ])
        .optional(),
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
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  }),
  component: Transactions,
})

function Transactions() {
  const navigate = useNavigate()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const createAmountRef = useRef<HTMLInputElement | null>(null)
  const editAmountRef = useRef<HTMLInputElement | null>(null)
  const detailModalRef = useRef<HTMLDivElement | null>(null)
  const deleteModalRef = useRef<HTMLDivElement | null>(null)
  const lastCreateCategoryId = useRef<string | null>(null)
  const lastEditCategoryId = useRef<string | null>(null)
  const isClearingDescription = useRef(false)

  type Account = {
    id: string
    name: string
    type: string
    initialBalance: number
    currentBalance?: number
    createdAt: string
    updatedAt: string
  }

  type Category = {
    id: string
    userId: string | null
    name: string
    type: 'income' | 'expense'
    system: boolean
    color: string | null
    createdAt: string
    updatedAt: string
  }

  type Subcategory = {
    id: string
    userId: string
    categoryId: string
    name: string
    color: string | null
    createdAt: string
    updatedAt: string
  }

  const search = Route.useSearch()
  const page = search.page ?? 1
  const typeFilter = search.type ?? ''
  const accountFilter = search.accountId ?? ''
  const categoryFilter = search.categoryId ?? ''
  const subcategoryFilter = search.subcategoryId ?? ''
  const descriptionFilter = search.description ?? ''
  const includeNotes = search.includeNotes ?? false
  const sortKey = search.sort ?? null
  const sortDirection = search.dir ?? 'desc'
  const startDateFilter = search.startDate ?? ''
  const endDateFilter = search.endDate ?? ''
  const hasActiveFilters =
    typeFilter ||
    accountFilter ||
    categoryFilter ||
    subcategoryFilter ||
    descriptionFilter ||
    includeNotes ||
    startDateFilter ||
    endDateFilter
  const hasHiddenFilters =
    typeFilter ||
    accountFilter ||
    categoryFilter ||
    subcategoryFilter ||
    includeNotes ||
    startDateFilter ||
    endDateFilter
  const [isFilterExpanded, setIsFilterExpanded] = useState(false)
  const [descriptionDraft, setDescriptionDraft] =
    useState(descriptionFilter)
  const debouncedDescription = useDebouncedValue(descriptionDraft, 300)

  const transactionsQuery = useTransactions({
    page,
    limit: 20,
    type: typeFilter || undefined,
    accountId: accountFilter || undefined,
    categoryId: categoryFilter || undefined,
    subcategoryId: subcategoryFilter || undefined,
    description: descriptionFilter || undefined,
    notes: includeNotes && descriptionFilter ? descriptionFilter : undefined,
    sort: sortKey || undefined,
    dir: sortKey ? sortDirection : undefined,
    startDate: startDateFilter || undefined,
    endDate: endDateFilter || undefined,
  })
  const createTransactionMutation = useCreateTransaction()
  const updateTransactionMutation = useUpdateTransaction()
  const deleteTransactionMutation = useDeleteTransaction()

  const accountsQuery = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const response = await api.get<Account[]>('/accounts')
      return response.data
    },
  })

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await api.get<Category[]>('/categories')
      return response.data
    },
  })

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TransactionCreateFormData>({
    resolver: zodResolver(transactionCreateSchema),
    defaultValues: {
      accountId: '',
      categoryId: '',
      subcategoryId: '',
      type: '',
      amount: '',
      date: '',
      description: '',
      notes: '',
    },
  })

  const {
    control: editControl,
    register: editRegister,
    handleSubmit: handleEditSubmit,
    reset: resetEdit,
    watch: watchEdit,
    setError: setEditError,
    setValue: setEditValue,
    formState: {
      errors: editErrors,
      isSubmitting: isEditSubmitting,
    },
  } = useForm<TransactionCreateFormData>({
    resolver: zodResolver(transactionCreateSchema),
    defaultValues: {
      accountId: '',
      categoryId: '',
      subcategoryId: '',
      type: '',
      amount: '',
      date: '',
      description: '',
      notes: '',
    },
  })

  const createCategoryId = watch('categoryId')
  const editCategoryId = watchEdit('categoryId')
  const categories = categoriesQuery.data ?? []
  const availableCategories = categories.filter((category) => !category.system)

  const createCategory = categories.find(
    (category) => category.id === createCategoryId,
  )
  const editCategory = categories.find(
    (category) => category.id === editCategoryId,
  )

  const createSubcategoriesQuery = useQuery({
    queryKey: ['subcategories', 'transaction-create', createCategoryId],
    queryFn: async () => {
      const response = await api.get<Subcategory[]>(
        `/categories/${createCategoryId}/subcategories`,
      )
      return response.data
    },
    enabled: Boolean(createCategoryId),
  })

  const editSubcategoriesQuery = useQuery({
    queryKey: ['subcategories', 'transaction-edit', editCategoryId],
    queryFn: async () => {
      const response = await api.get<Subcategory[]>(
        `/categories/${editCategoryId}/subcategories`,
      )
      return response.data
    },
    enabled: Boolean(editCategoryId),
  })

  const transactions = transactionsQuery.data?.data ?? []
  const total = transactionsQuery.data?.total ?? 0
  const limit = transactionsQuery.data?.limit ?? 20
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const dateFormatter = new Intl.DateTimeFormat('pt-BR')

  const accountMap = new Map(
    (accountsQuery.data ?? []).map((account) => [account.id, account.name]),
  )
  const categoryMap = new Map(
    categories.map((category) => [category.id, category.name]),
  )
  function handleSort(
    nextKey:
      | 'date'
      | 'description'
      | 'account'
      | 'category'
      | 'subcategory'
      | 'type'
      | 'amount',
  ) {
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

  const filterSubcategoriesQuery = useQuery({
    queryKey: ['subcategories', 'transaction-filter', categoryFilter],
    queryFn: async () => {
      const response = await api.get<Subcategory[]>(
        `/categories/${categoryFilter}/subcategories`,
      )
      return response.data
    },
    enabled: Boolean(categoryFilter),
  })

  useEffect(() => {
    if (!createCategoryId) {
      setValue('type', '')
      setValue('subcategoryId', '')
      lastCreateCategoryId.current = null
      return
    }

    if (lastCreateCategoryId.current !== createCategoryId) {
      setValue('subcategoryId', '')
      lastCreateCategoryId.current = createCategoryId
    }

    if (createCategory?.type) {
      setValue('type', createCategory.type)
    }
  }, [createCategory?.type, createCategoryId, setValue])

  useEffect(() => {
    if (!editCategoryId) {
      setEditValue('type', '')
      setEditValue('subcategoryId', '')
      lastEditCategoryId.current = null
      return
    }

    if (lastEditCategoryId.current !== editCategoryId) {
      setEditValue('subcategoryId', '')
      lastEditCategoryId.current = editCategoryId
    }

    if (editCategory?.type) {
      setEditValue('type', editCategory.type)
    }
  }, [editCategory?.type, editCategoryId, setEditValue])

  useEffect(() => {
    const hasOpenModal =
      isCreateOpen || isEditOpen || isDeleteConfirmOpen || !!selectedTransaction
    if (!hasOpenModal) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isCreateOpen, isEditOpen, isDeleteConfirmOpen, selectedTransaction])

  useEffect(() => {
    if (isCreateOpen) {
      createAmountRef.current?.focus()
    }
  }, [isCreateOpen])

  useEffect(() => {
    if (isEditOpen) {
      editAmountRef.current?.focus()
    }
  }, [isEditOpen])

  useEffect(() => {
    if (isDeleteConfirmOpen) {
      deleteModalRef.current?.focus()
      return
    }
    if (selectedTransaction && !isEditOpen) {
      detailModalRef.current?.focus()
    }
  }, [isDeleteConfirmOpen, isEditOpen, selectedTransaction])

  useEffect(() => {
    const hasOpenModal =
      isCreateOpen || isEditOpen || isDeleteConfirmOpen || !!selectedTransaction
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
        return
      }

      if (isCreateOpen) {
        setIsCreateOpen(false)
        return
      }

      if (selectedTransaction) {
        setSelectedTransaction(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    isCreateOpen,
    isEditOpen,
    isDeleteConfirmOpen,
    selectedTransaction,
  ])

  useEffect(() => {
    setDescriptionDraft(descriptionFilter)
  }, [descriptionFilter])

  useEffect(() => {
    if (debouncedDescription === descriptionFilter) {
      return
    }
    if (isClearingDescription.current) {
      isClearingDescription.current = false
      return
    }
    const trimmedValue = debouncedDescription.trim()
    navigate({
      search: (prev) => ({
        ...prev,
        description: trimmedValue ? trimmedValue : undefined,
        includeNotes: trimmedValue ? prev.includeNotes : undefined,
        page: 1,
      }),
      replace: true,
    })
  }, [debouncedDescription, descriptionFilter, navigate])

  useEffect(() => {
    if (hasHiddenFilters) {
      setIsFilterExpanded(true)
    } else {
      setIsFilterExpanded(false)
    }
  }, [hasHiddenFilters])

  useEffect(() => {
    const nextPage = totalPages > 0 ? Math.min(page, totalPages) : page
    if (nextPage !== page) {
      navigate({
        search: (prev) => ({ ...prev, page: nextPage }),
        replace: true,
      })
    }
  }, [navigate, page, totalPages])

  useEffect(() => {
    if (sortKey) {
      return
    }
    navigate({
      search: (prev) => ({
        ...prev,
        sort: 'date',
        dir: 'desc',
      }),
      replace: true,
    })
  }, [navigate, sortKey])

  const handleOpenEdit = (transaction: Transaction) => {
    setSelectedTransaction(transaction)
    lastEditCategoryId.current = transaction.categoryId
    resetEdit({
      accountId: transaction.accountId,
      categoryId: transaction.categoryId,
      subcategoryId: transaction.subcategoryId ?? '',
      type: transaction.type,
      amount: `$ ${formatCurrencyValue(transaction.amount)}`,
      date: transaction.date,
      description: transaction.description ?? '',
      notes: transaction.notes ?? '',
    })
    setIsEditOpen(true)
  }

  const handleOpenDelete = (transaction: Transaction) => {
    setSelectedTransaction(transaction)
    setDeleteError(null)
    setIsDeleteConfirmOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">Transacoes</h2>
          <p className="text-sm text-muted-foreground">
            Acompanhe receitas e despesas registradas nas contas.
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          Nova transacao
        </Button>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <h3 className="text-base font-semibold">Filtros</h3>
          <div className="flex flex-1 items-center gap-3">
            <Input
              id="filter-description"
              placeholder="Buscar por descricao"
              value={descriptionDraft}
              onChange={(event) => setDescriptionDraft(event.target.value)}
            />
            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  onClick={() => {
                    isClearingDescription.current = true
                    setDescriptionDraft('')
                    navigate({
                      search: (prev) => ({
                        ...prev,
                        page: 1,
                        type: undefined,
                        accountId: undefined,
                        categoryId: undefined,
                        subcategoryId: undefined,
                        description: undefined,
                        includeNotes: undefined,
                        startDate: undefined,
                        endDate: undefined,
                      }),
                    })
                  }}
                >
                  Limpar filtros
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => setIsFilterExpanded((prev) => !prev)}
              >
                {isFilterExpanded ? 'Ocultar filtros' : 'Mostrar filtros'}
              </Button>
            </div>
          </div>
        </div>

        {isFilterExpanded && (
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="space-y-2 lg:col-span-3">
              <Label htmlFor="filter-include-notes">Busca</Label>
              <label
                className="flex items-center gap-2 text-sm text-muted-foreground"
                title={
                  descriptionFilter
                    ? undefined
                    : 'Informe uma descricao para buscar nas notas'
                }
              >
                <input
                  id="filter-include-notes"
                  type="checkbox"
                  className="h-4 w-4"
                  checked={includeNotes}
                  disabled={!descriptionFilter}
                  onChange={(event) =>
                    navigate({
                      search: (prev) => ({
                        ...prev,
                        includeNotes: event.target.checked ? true : undefined,
                        page: 1,
                      }),
                    })
                  }
                />
                Buscar nas notas
              </label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-start-date">Data inicial</Label>
              <Input
                id="filter-start-date"
                type="date"
                value={startDateFilter}
                onChange={(event) =>
                  navigate({
                    search: (prev) => ({
                      ...prev,
                      startDate: event.target.value || undefined,
                      page: 1,
                    }),
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-end-date">Data final</Label>
              <Input
                id="filter-end-date"
                type="date"
                value={endDateFilter}
                onChange={(event) =>
                  navigate({
                    search: (prev) => ({
                      ...prev,
                      endDate: event.target.value || undefined,
                      page: 1,
                    }),
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-type">Tipo</Label>
              <select
                id="filter-type"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={typeFilter}
                onChange={(event) =>
                  navigate({
                    search: (prev) => ({
                      ...prev,
                      type: event.target.value || undefined,
                      page: 1,
                    }),
                  })
                }
              >
                <option value="">Todos</option>
                <option value="income">Receita</option>
                <option value="expense">Despesa</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-account">Conta</Label>
              <select
                id="filter-account"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={accountFilter}
                onChange={(event) =>
                  navigate({
                    search: (prev) => ({
                      ...prev,
                      accountId: event.target.value || undefined,
                      page: 1,
                    }),
                  })
                }
              >
                <option value="">Todas</option>
                {(accountsQuery.data ?? []).map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-category">Categoria</Label>
              <select
                id="filter-category"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={categoryFilter}
                onChange={(event) =>
                  navigate({
                    search: (prev) => ({
                      ...prev,
                      categoryId: event.target.value || undefined,
                      subcategoryId: undefined,
                      page: 1,
                    }),
                  })
                }
              >
                <option value="">Todas</option>
                {availableCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-subcategory">Subcategoria</Label>
              <select
                id="filter-subcategory"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={subcategoryFilter}
                onChange={(event) =>
                  navigate({
                    search: (prev) => ({
                      ...prev,
                      subcategoryId: event.target.value || undefined,
                      page: 1,
                    }),
                  })
                }
                disabled={!categoryFilter}
              >
                <option value="">Todas</option>
                {(filterSubcategoriesQuery.data ?? []).map((subcategory) => (
                  <option key={subcategory.id} value={subcategory.id}>
                    {subcategory.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">
                <button
                  className="inline-flex items-center gap-2 text-left"
                  type="button"
                  onClick={() => handleSort('date')}
                >
                  Data
                  <SortIcon isActive={sortKey === 'date'} direction={sortDirection} />
                </button>
              </th>
              <th className="px-4 py-3">
                <button
                  className="inline-flex items-center gap-2 text-left"
                  type="button"
                  onClick={() => handleSort('description')}
                >
                  Descricao
                  <SortIcon
                    isActive={sortKey === 'description'}
                    direction={sortDirection}
                  />
                </button>
              </th>
              <th className="px-4 py-3">
                <button
                  className="inline-flex items-center gap-2 text-left"
                  type="button"
                  onClick={() => handleSort('account')}
                >
                  Conta
                  <SortIcon
                    isActive={sortKey === 'account'}
                    direction={sortDirection}
                  />
                </button>
              </th>
              <th className="px-4 py-3">
                <button
                  className="inline-flex items-center gap-2 text-left"
                  type="button"
                  onClick={() => handleSort('category')}
                >
                  Categoria
                  <SortIcon
                    isActive={sortKey === 'category'}
                    direction={sortDirection}
                  />
                </button>
              </th>
              <th className="px-4 py-3">
                <button
                  className="inline-flex items-center gap-2 text-left"
                  type="button"
                  onClick={() => handleSort('subcategory')}
                >
                  Subcategoria
                  <SortIcon
                    isActive={sortKey === 'subcategory'}
                    direction={sortDirection}
                  />
                </button>
              </th>
              <th className="px-4 py-3">
                <button
                  className="inline-flex items-center gap-2 text-left"
                  type="button"
                  onClick={() => handleSort('type')}
                >
                  Tipo
                  <SortIcon isActive={sortKey === 'type'} direction={sortDirection} />
                </button>
              </th>
              <th className="px-4 py-3 text-right">
                <button
                  className="inline-flex items-center gap-2 text-right"
                  type="button"
                  onClick={() => handleSort('amount')}
                >
                  Valor
                  <SortIcon
                    isActive={sortKey === 'amount'}
                    direction={sortDirection}
                  />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {transactionsQuery.isLoading && (
              <tr>
                <td className="px-4 py-6 text-muted-foreground" colSpan={7}>
                  Carregando transacoes...
                </td>
              </tr>
            )}
            {!transactionsQuery.isLoading && transactions.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-muted-foreground" colSpan={7}>
                  Nenhuma transacao encontrada.
                </td>
              </tr>
            )}
            {transactions.map((transaction) => (
              <tr
                key={transaction.id}
                className="cursor-pointer border-t hover:bg-muted/30"
                onClick={() => {
                  setDeleteError(null)
                  setSelectedTransaction(transaction)
                }}
              >
                <td className="px-4 py-3">
                  {dateFormatter.format(new Date(transaction.date))}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span>
                      {transaction.description ||
                        transaction.categoryName ||
                        categoryMap.get(transaction.categoryId) ||
                        'Sem descricao'}
                    </span>
                    {transaction.notes && (
                      <span
                        className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground"
                        title={transaction.notes}
                      >
                        Notas
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {transaction.accountName ||
                    accountMap.get(transaction.accountId) ||
                    '-'}
                </td>
                <td className="px-4 py-3">
                  {transaction.categoryName ||
                    categoryMap.get(transaction.categoryId) ||
                    '-'}
                </td>
                <td className="px-4 py-3">
                  {transaction.subcategoryId
                    ? transaction.subcategoryName || '-'
                    : '-'}
                </td>
                <td className="px-4 py-3">
                  {transaction.type === 'income' ? 'Receita' : 'Despesa'}
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  {formatCurrencyValue(transaction.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            disabled={page === 1}
            onClick={() =>
              navigate({
                search: (prev) => ({
                  ...prev,
                  page: Math.max(1, page - 1),
                }),
              })
            }
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            disabled={page === totalPages}
            onClick={() =>
              navigate({
                search: (prev) => ({
                  ...prev,
                  page: Math.min(totalPages, page + 1),
                }),
              })
            }
          >
            Proxima
          </Button>
        </div>
      )}

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="fixed inset-0"
            onClick={() => setIsCreateOpen(false)}
          />
          <div className="relative w-full max-w-2xl rounded-lg border bg-background p-6 shadow-lg">
            <div>
              <h3 className="text-lg font-semibold">Nova transacao</h3>
              <p className="text-sm text-muted-foreground">
                Preencha os dados para registrar uma nova transacao.
              </p>
            </div>

            <form
              className="mt-6 space-y-4"
              onSubmit={handleSubmit(async (formData) => {
                try {
                  const parsedAmount = parseCurrencyInput(formData.amount) ?? 0
                  await createTransactionMutation.mutateAsync({
                    accountId: formData.accountId,
                    categoryId: formData.categoryId,
                    subcategoryId: formData.subcategoryId
                      ? formData.subcategoryId
                      : null,
                    type: formData.type as Transaction['type'],
                    amount: parsedAmount,
                    date: formData.date,
                    description: formData.description?.trim() || null,
                    notes: formData.notes?.trim() || null,
                  })
                  setIsCreateOpen(false)
                  reset()
                } catch (error: unknown) {
                  setError('root', {
                    message: getApiErrorMessage(error, {
                      defaultMessage:
                        'Erro ao criar transacao. Tente novamente.',
                    }),
                  })
                }
              })}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="transaction-account">Conta</Label>
                  <select
                    id="transaction-account"
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    aria-invalid={!!errors.accountId}
                    {...register('accountId')}
                  >
                    <option value="">Selecione</option>
                    {(accountsQuery.data ?? []).map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                  {errors.accountId && (
                    <p className="text-sm text-destructive">
                      {errors.accountId.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="transaction-date">Data</Label>
                  <Input
                    id="transaction-date"
                    type="date"
                    className="h-10"
                    aria-invalid={!!errors.date}
                    {...register('date')}
                  />
                  {errors.date && (
                    <p className="text-sm text-destructive">
                      {errors.date.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="transaction-category">Categoria</Label>
                  <select
                    id="transaction-category"
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    aria-invalid={!!errors.categoryId}
                    {...register('categoryId')}
                  >
                    <option value="">Selecione</option>
                    {availableCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  {errors.categoryId && (
                    <p className="text-sm text-destructive">
                      {errors.categoryId.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="transaction-subcategory">Subcategoria</Label>
                  <select
                    id="transaction-subcategory"
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    aria-invalid={!!errors.subcategoryId}
                    {...register('subcategoryId')}
                    disabled={!createCategoryId}
                  >
                    <option value="">Sem subcategoria</option>
                    {(createSubcategoriesQuery.data ?? []).map(
                      (subcategory) => (
                        <option key={subcategory.id} value={subcategory.id}>
                          {subcategory.name}
                        </option>
                      ),
                    )}
                  </select>
                  {errors.subcategoryId && (
                    <p className="text-sm text-destructive">
                      {errors.subcategoryId.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="transaction-type">Tipo</Label>
                  <Input
                    id="transaction-type"
                    className="h-10"
                    readOnly
                    placeholder="Selecione uma categoria"
                    aria-invalid={!!errors.type}
                    {...register('type')}
                  />
                  {errors.type && (
                    <p className="text-sm text-destructive">
                      {errors.type.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="transaction-amount">Valor</Label>
                  <Controller
                    control={control}
                    name="amount"
                    render={({ field }) => (
                      <Input
                        id="transaction-amount"
                        type="text"
                        inputMode="numeric"
                        placeholder="$ 0,00"
                        className="h-10"
                        ref={createAmountRef}
                        value={field.value}
                        onChange={(event) =>
                          field.onChange(
                            formatCurrencyInput(event.target.value),
                          )
                        }
                        aria-invalid={!!errors.amount}
                      />
                    )}
                  />
                  {errors.amount && (
                    <p className="text-sm text-destructive">
                      {errors.amount.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="transaction-description">Descricao</Label>
                <Input
                  id="transaction-description"
                  placeholder="Ex: Supermercado"
                  className="h-10"
                  aria-invalid={!!errors.description}
                  {...register('description')}
                />
                {errors.description && (
                  <p className="text-sm text-destructive">
                    {errors.description.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="transaction-notes">Notas</Label>
                <Input
                  id="transaction-notes"
                  placeholder="Opcional"
                  className="h-10"
                  aria-invalid={!!errors.notes}
                  {...register('notes')}
                />
                {errors.notes && (
                  <p className="text-sm text-destructive">
                    {errors.notes.message}
                  </p>
                )}
              </div>

              {errors.root && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {errors.root.message}
                </div>
              )}

              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  Salvar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedTransaction && !isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="fixed inset-0"
            onClick={() => setSelectedTransaction(null)}
          />
          <div
            className="relative w-full max-w-lg rounded-lg border bg-background p-6 shadow-lg"
            ref={detailModalRef}
            tabIndex={-1}
          >
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">Detalhes da transacao</h3>
              <p className="text-sm text-muted-foreground">
                Informacoes da transacao selecionada.
              </p>
            </div>

            <div className="mt-6 grid gap-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Data</span>
                <span className="font-medium">
                  {dateFormatter.format(
                    new Date(selectedTransaction.date),
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Descricao</span>
                <span className="font-medium">
                  {selectedTransaction.description ||
                    categoryMap.get(selectedTransaction.categoryId) ||
                    'Sem descricao'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Conta</span>
                <span className="font-medium">
                  {selectedTransaction.accountName ||
                    accountMap.get(selectedTransaction.accountId) ||
                    '-'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Categoria</span>
                <span className="font-medium">
                  {selectedTransaction.categoryName ||
                    categoryMap.get(selectedTransaction.categoryId) ||
                    '-'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Subcategoria</span>
                <span className="font-medium">
                  {selectedTransaction.subcategoryId
                    ? selectedTransaction.subcategoryName || '-'
                    : '-'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Tipo</span>
                <span className="font-medium">
                  {selectedTransaction.type === 'income'
                    ? 'Receita'
                    : 'Despesa'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Valor</span>
                <span className="font-semibold">
                  {formatCurrencyValue(selectedTransaction.amount)}
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
                  {dateFormatter.format(
                    new Date(selectedTransaction.createdAt),
                  )}
                </span>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="destructive"
                  onClick={() => handleOpenDelete(selectedTransaction)}
                >
                  Excluir
                </Button>
                <Button
                  variant="outline"
                  autoFocus
                  onClick={() => handleOpenEdit(selectedTransaction)}
                >
                  Editar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isEditOpen && selectedTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="fixed inset-0"
            onClick={() => setIsEditOpen(false)}
          />
          <div className="relative w-full max-w-2xl rounded-lg border bg-background p-6 shadow-lg">
            <div>
              <h3 className="text-lg font-semibold">Editar transacao</h3>
              <p className="text-sm text-muted-foreground">
                Atualize os dados da transacao selecionada.
              </p>
            </div>

            <form
              className="mt-6 space-y-4"
              onSubmit={handleEditSubmit(async (formData) => {
                try {
                  const parsedAmount = parseCurrencyInput(formData.amount) ?? 0
                  await updateTransactionMutation.mutateAsync({
                    id: selectedTransaction.id,
                    payload: {
                      accountId: formData.accountId,
                      categoryId: formData.categoryId,
                      subcategoryId: formData.subcategoryId
                        ? formData.subcategoryId
                        : null,
                      type: formData.type as Transaction['type'],
                      amount: parsedAmount,
                      date: formData.date,
                      description: formData.description?.trim() || null,
                      notes: formData.notes?.trim() || null,
                    },
                  })
                  setIsEditOpen(false)
                  setSelectedTransaction(null)
                } catch (error: unknown) {
                  setEditError('root', {
                    message: getApiErrorMessage(error, {
                      defaultMessage:
                        'Erro ao atualizar transacao. Tente novamente.',
                    }),
                  })
                }
              })}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="transaction-edit-account">Conta</Label>
                  <select
                    id="transaction-edit-account"
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    aria-invalid={!!editErrors.accountId}
                    {...editRegister('accountId')}
                  >
                    <option value="">Selecione</option>
                    {(accountsQuery.data ?? []).map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                  {editErrors.accountId && (
                    <p className="text-sm text-destructive">
                      {editErrors.accountId.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="transaction-edit-date">Data</Label>
                  <Input
                    id="transaction-edit-date"
                    type="date"
                    className="h-10"
                    aria-invalid={!!editErrors.date}
                    {...editRegister('date')}
                  />
                  {editErrors.date && (
                    <p className="text-sm text-destructive">
                      {editErrors.date.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="transaction-edit-category">Categoria</Label>
                  <select
                    id="transaction-edit-category"
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    aria-invalid={!!editErrors.categoryId}
                    {...editRegister('categoryId')}
                  >
                    <option value="">Selecione</option>
                    {availableCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  {editErrors.categoryId && (
                    <p className="text-sm text-destructive">
                      {editErrors.categoryId.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="transaction-edit-subcategory">
                    Subcategoria
                  </Label>
                  <select
                    id="transaction-edit-subcategory"
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    aria-invalid={!!editErrors.subcategoryId}
                    {...editRegister('subcategoryId')}
                    disabled={!editCategoryId}
                  >
                    <option value="">Sem subcategoria</option>
                    {(editSubcategoriesQuery.data ?? []).map((subcategory) => (
                      <option key={subcategory.id} value={subcategory.id}>
                        {subcategory.name}
                      </option>
                    ))}
                  </select>
                  {editErrors.subcategoryId && (
                    <p className="text-sm text-destructive">
                      {editErrors.subcategoryId.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="transaction-edit-type">Tipo</Label>
                  <Input
                    id="transaction-edit-type"
                    className="h-10"
                    readOnly
                    placeholder="Selecione uma categoria"
                    aria-invalid={!!editErrors.type}
                    {...editRegister('type')}
                  />
                  {editErrors.type && (
                    <p className="text-sm text-destructive">
                      {editErrors.type.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="transaction-edit-amount">Valor</Label>
                  <Controller
                    control={editControl}
                    name="amount"
                    render={({ field }) => (
                      <Input
                        id="transaction-edit-amount"
                        type="text"
                        inputMode="numeric"
                        placeholder="$ 0,00"
                        className="h-10"
                        ref={editAmountRef}
                        value={field.value}
                        onChange={(event) =>
                          field.onChange(
                            formatCurrencyInput(event.target.value),
                          )
                        }
                        aria-invalid={!!editErrors.amount}
                      />
                    )}
                  />
                  {editErrors.amount && (
                    <p className="text-sm text-destructive">
                      {editErrors.amount.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="transaction-edit-description">
                  Descricao
                </Label>
                <Input
                  id="transaction-edit-description"
                  placeholder="Ex: Supermercado"
                  className="h-10"
                  aria-invalid={!!editErrors.description}
                  {...editRegister('description')}
                />
                {editErrors.description && (
                  <p className="text-sm text-destructive">
                    {editErrors.description.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="transaction-edit-notes">Notas</Label>
                <Input
                  id="transaction-edit-notes"
                  placeholder="Opcional"
                  className="h-10"
                  aria-invalid={!!editErrors.notes}
                  {...editRegister('notes')}
                />
                {editErrors.notes && (
                  <p className="text-sm text-destructive">
                    {editErrors.notes.message}
                  </p>
                )}
              </div>

              {editErrors.root && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {editErrors.root.message}
                </div>
              )}

              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isEditSubmitting}>
                  Atualizar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDeleteConfirmOpen && selectedTransaction && (
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
              <h3 className="text-lg font-semibold">Confirmar exclusao</h3>
              <p className="text-sm text-muted-foreground">
                Tem certeza que deseja excluir esta transacao? Essa acao nao
                pode ser desfeita.
              </p>
            </div>

            {deleteError && (
              <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {deleteError}
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
                onClick={async () => {
                  try {
                    await deleteTransactionMutation.mutateAsync(
                      selectedTransaction.id,
                    )
                    setIsDeleteConfirmOpen(false)
                    setSelectedTransaction(null)
                  } catch (error: unknown) {
                    setDeleteError(
                      getApiErrorMessage(error, {
                        defaultMessage:
                          'Erro ao excluir transacao. Tente novamente.',
                      }),
                    )
                  }
                }}
              >
                Excluir
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
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
