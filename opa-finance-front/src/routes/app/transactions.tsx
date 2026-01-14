import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { ArrowLeftRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAccounts } from '@/features/accounts'
import {
  fetchSubcategories,
  useCategories,
} from '@/features/categories'
import {
  useCreateTransaction,
  useDeleteTransaction,
  useTransactionDescriptions,
  useTransactions,
  useUpdateTransaction,
  type TransactionsListResponse,
  type Transaction,
} from '@/features/transactions'
import { useCreateTransfer } from '@/features/transfers'
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
  transferCreateSchema,
  type TransferCreateFormData,
} from '@/schemas/transfer.schema'

export const Route = createFileRoute('/app/transactions')({
  validateSearch: z.object({
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
    limit: z
      .preprocess(
        (value) => {
          const parsed = Number(value)
          if (!Number.isFinite(parsed) || parsed < 1) {
            return undefined
          }
          return Math.floor(parsed)
        },
        z.number().int().min(1).max(100),
      )
      .optional(),
    type: z
      .preprocess(
        (value) => {
          const allowed = ['income', 'expense']
          if (typeof value !== 'string') {
            return undefined
          }
          return allowed.includes(value) ? value : undefined
        },
        z.enum(['income', 'expense']),
      )
      .optional(),
    accountId: z.string().optional(),
    categoryId: z.string().optional(),
    subcategoryId: z.string().optional(),
    description: z.string().optional(),
    includeNotes: z
      .preprocess(
        (value) => {
          if (typeof value === 'boolean') {
            return value
          }
          if (value === 'true' || value === '1') {
            return true
          }
          if (value === 'false' || value === '0') {
            return false
          }
          return undefined
        },
        z.boolean().optional(),
      )
      .optional(),
    notesOnly: z
      .preprocess(
        (value) => {
          if (typeof value === 'boolean') {
            return value
          }
          if (value === 'true' || value === '1') {
            return true
          }
          if (value === 'false' || value === '0') {
            return false
          }
          return undefined
        },
        z.boolean().optional(),
      )
      .optional(),
    sort: z
      .preprocess(
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
        z.enum([
          'date',
          'description',
          'account',
          'category',
          'subcategory',
          'type',
          'amount',
        ]),
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
  const navigate = Route.useNavigate()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isTransferOpen, setIsTransferOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [repeatTransferError, setRepeatTransferError] = useState<string | null>(
    null,
  )
  const [transferEditError, setTransferEditError] = useState<string | null>(
    null,
  )
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [isRepeatTransferLoading, setIsRepeatTransferLoading] = useState(false)
  const [isEditTransferLoading, setIsEditTransferLoading] = useState(false)
  const [transferEditContext, setTransferEditContext] = useState<{
    expenseId: string
    incomeId: string
  } | null>(null)
  const [copiedValue, setCopiedValue] = useState<'average' | 'total' | null>(
    null,
  )
  const [detailCopiedField, setDetailCopiedField] = useState<
    'description' | 'amount' | null
  >(null)
  const [isDescriptionSuggestionsOpen, setIsDescriptionSuggestionsOpen] =
    useState(false)
  const [isDescriptionFocused, setIsDescriptionFocused] = useState(false)
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0)
  const createAmountRef = useRef<HTMLInputElement | null>(null)
  const transferAmountRef = useRef<HTMLInputElement | null>(null)
  const editAmountRef = useRef<HTMLInputElement | null>(null)
  const descriptionInputRef = useRef<HTMLInputElement | null>(null)
  const detailModalRef = useRef<HTMLDivElement | null>(null)
  const deleteModalRef = useRef<HTMLDivElement | null>(null)
  const bulkDeleteModalRef = useRef<HTMLDivElement | null>(null)
  const selectAllRef = useRef<HTMLInputElement | null>(null)
  const copyTimeoutRef = useRef<number | null>(null)
  const detailCopyTimeoutRef = useRef<number | null>(null)
  const lastCreateCategoryId = useRef<string | null>(null)
  const lastEditCategoryId = useRef<string | null>(null)
  const isClearingDescription = useRef(false)

  const search = Route.useSearch()
  const page = search.page ?? 1
  const limit = search.limit ?? 10
  const typeFilter = search.type ?? ''
  const accountFilter = search.accountId ?? ''
  const categoryFilter = search.categoryId ?? ''
  const subcategoryFilter = search.subcategoryId ?? ''
  const descriptionFilter = search.description ?? ''
  const includeNotes = search.includeNotes ?? false
  const notesOnly = search.notesOnly ?? false
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
    notesOnly ||
    startDateFilter ||
    endDateFilter
  const hasHiddenFilters =
    typeFilter ||
    accountFilter ||
    categoryFilter ||
    subcategoryFilter ||
    includeNotes ||
    notesOnly ||
    startDateFilter ||
    endDateFilter
  const [isFilterExpanded, setIsFilterExpanded] = useState(false)
  const [descriptionDraft, setDescriptionDraft] =
    useState(descriptionFilter)
  const debouncedDescription = useDebouncedValue(descriptionDraft, 500)
  const canSearchNotes = descriptionDraft.trim().length > 0
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())

  const transactionsQuery = useTransactions({
    page,
    limit,
    type: typeFilter || undefined,
    accountId: accountFilter || undefined,
    categoryId: categoryFilter || undefined,
    subcategoryId: subcategoryFilter || undefined,
    description: notesOnly ? undefined : descriptionFilter || undefined,
    notes:
      (includeNotes || notesOnly) && descriptionFilter
        ? descriptionFilter
        : undefined,
    sort: sortKey || undefined,
    dir: sortKey ? sortDirection : undefined,
    startDate: startDateFilter || undefined,
    endDate: endDateFilter || undefined,
  })
  const createTransactionMutation = useCreateTransaction()
  const createTransferMutation = useCreateTransfer()
  const updateTransactionMutation = useUpdateTransaction()
  const deleteTransactionMutation = useDeleteTransaction()

  const accountsQuery = useAccounts()
  const categoriesQuery = useCategories()

  const {
    control,
    register,
    handleSubmit,
    reset,
    getValues,
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

  const transferForm = useForm<TransferCreateFormData>({
    resolver: zodResolver(transferCreateSchema),
    defaultValues: {
      fromAccountId: '',
      toAccountId: '',
      amount: '',
      date: '',
      description: '',
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
  const createType = watch('type')
  const createAccountId = watch('accountId')
  const createDescription = watch('description') ?? ''
  const editCategoryId = watchEdit('categoryId')
  const editType = watchEdit('type')
  const categories = categoriesQuery.data ?? []
  const availableCategories = categories.filter((category) => !category.system)
  const primaryAccountId =
    (accountsQuery.data ?? []).find((account) => account.isPrimary)?.id ?? ''
  const debouncedCreateDescription = useDebouncedValue(createDescription, 1000)

  const createCategory = categories.find(
    (category) => category.id === createCategoryId,
  )
  const editCategory = categories.find(
    (category) => category.id === editCategoryId,
  )

  const createSubcategoriesQuery = useQuery({
    queryKey: ['subcategories', 'transaction-create', createCategoryId],
    queryFn: () => fetchSubcategories(createCategoryId ?? ''),
    enabled: Boolean(createCategoryId),
  })

  const editSubcategoriesQuery = useQuery({
    queryKey: ['subcategories', 'transaction-edit', editCategoryId],
    queryFn: () => fetchSubcategories(editCategoryId ?? ''),
    enabled: Boolean(editCategoryId),
  })

  const suggestionsQueryText = debouncedCreateDescription
  const trimmedSuggestionsQueryText = suggestionsQueryText.trim()
  const shouldFilterSuggestions =
    /\s/.test(suggestionsQueryText) || trimmedSuggestionsQueryText.length > 0
  const baseDescriptionSuggestionsQuery = useTransactionDescriptions(
    {
      accountId: createAccountId || '',
      limit: 20,
    },
    {
      enabled: Boolean(isCreateOpen && createAccountId),
    },
  )
  const filteredDescriptionSuggestionsQuery = useTransactionDescriptions(
    {
      accountId: createAccountId || '',
      q: shouldFilterSuggestions ? trimmedSuggestionsQueryText : undefined,
      limit: 20,
    },
    {
      enabled: Boolean(isCreateOpen && createAccountId && shouldFilterSuggestions),
    },
  )
  const descriptionSuggestions = (() => {
    const baseItems = baseDescriptionSuggestionsQuery.data?.items ?? []
    const filteredItems = filteredDescriptionSuggestionsQuery.data?.items ?? []
    if (!shouldFilterSuggestions) {
      return baseItems.slice(0, 5)
    }
    if (filteredItems.length > 0) {
      return filteredItems.slice(0, 5)
    }
    const query = normalizeText(trimmedSuggestionsQueryText)
    const filtered = baseItems.filter((item) =>
      normalizeText(item).includes(query),
    )
    return filtered.slice(0, 5)
  })()
  useEffect(() => {
    setActiveSuggestionIndex(0)
  }, [descriptionSuggestions.length, isDescriptionSuggestionsOpen])

  const transactions = transactionsQuery.data?.data ?? []
  const total = transactionsQuery.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const dateFormatter = new Intl.DateTimeFormat('pt-BR')
  const selectedTransactions = transactions.filter((transaction) =>
    selectedIds.has(transaction.id),
  )
  const selectedCount = selectedTransactions.length
  const allSelected =
    transactions.length > 0 && selectedCount === transactions.length
  const hasSelection = selectedCount > 0
  const selectedTotal = selectedTransactions.reduce((acc, transaction) => {
    const signedAmount =
      transaction.type === 'income'
        ? transaction.amount
        : -transaction.amount
    return acc + signedAmount
  }, 0)
  const selectedAverage =
    selectedCount >= 1 ? selectedTotal / selectedCount : 0
  const amountTone = (value: number) => {
    if (value > 0) return 'text-emerald-600'
    if (value < 0) return 'text-rose-600'
    return 'text-muted-foreground'
  }
  const getTransferRelatedIds = (transferId: string | null) => {
    if (!transferId) {
      return []
    }
    return transactions
      .filter((item) => item.transferId === transferId)
      .map((item) => item.id)
  }

  const buildBulkDeleteIds = (items: Transaction[]) => {
    const ids = new Set<string>()
    const seenTransfers = new Set<string>()
    items.forEach((transaction) => {
      if (transaction.transferId) {
        if (seenTransfers.has(transaction.transferId)) {
          return
        }
        seenTransfers.add(transaction.transferId)
      }
      ids.add(transaction.id)
    })
    return Array.from(ids)
  }

  const handleDateFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    if (typeof input.showPicker === 'function') {
      input.showPicker()
    }
  }
  const paginationItems = buildPaginationItems(page, totalPages)

  const accountMap = new Map(
    (accountsQuery.data ?? []).map((account) => [account.id, account.name]),
  )
  const categoryMap = new Map(
    categories.map((category) => [category.id, category.name]),
  )

  const handleClearFilters = () => {
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
        notesOnly: undefined,
        startDate: undefined,
        endDate: undefined,
      }),
    })
  }
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
    queryFn: () => fetchSubcategories(categoryFilter ?? ''),
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
      isCreateOpen ||
      isTransferOpen ||
      isEditOpen ||
      isDeleteConfirmOpen ||
      isBulkDeleteOpen ||
      !!selectedTransaction
    if (!hasOpenModal) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [
    isCreateOpen,
    isTransferOpen,
    isEditOpen,
    isDeleteConfirmOpen,
    isBulkDeleteOpen,
    selectedTransaction,
  ])

  useEffect(() => {
    const hasOpenModal =
      isCreateOpen ||
      isTransferOpen ||
      isEditOpen ||
      isDeleteConfirmOpen ||
      isBulkDeleteOpen ||
      !!selectedTransaction
    if (hasOpenModal || (!hasActiveFilters && selectedIds.size === 0)) {
      return
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }
      if (hasActiveFilters) {
        handleClearFilters()
        return
      }
      if (selectedIds.size > 0) {
        setSelectedIds(new Set())
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [
    handleClearFilters,
    hasActiveFilters,
    isCreateOpen,
    isTransferOpen,
    isEditOpen,
    isDeleteConfirmOpen,
    isBulkDeleteOpen,
    selectedTransaction,
    selectedIds.size,
  ])

  useEffect(() => {
    if (isCreateOpen) {
      setValue('date', formatDateInput(new Date()))
      const currentAccountId = getValues('accountId')
      if (!currentAccountId && primaryAccountId) {
        setValue('accountId', primaryAccountId)
      }
      descriptionInputRef.current?.focus()
    }
  }, [getValues, isCreateOpen, primaryAccountId, setValue])

  useEffect(() => {
    if (isTransferOpen) {
      if (!transferEditContext) {
        transferForm.setValue('date', formatDateInput(new Date()))
        const currentFromAccountId = transferForm.getValues('fromAccountId')
        if (!currentFromAccountId && primaryAccountId) {
          transferForm.setValue('fromAccountId', primaryAccountId)
        }
      }
      transferAmountRef.current?.focus()
    }
  }, [isTransferOpen, primaryAccountId, transferEditContext, transferForm])

  useEffect(() => {
    if (isEditOpen) {
      const editDescriptionInput = document.getElementById(
        'transaction-edit-description',
      ) as HTMLInputElement | null
      editDescriptionInput?.focus()
    }
  }, [isEditOpen])

  useEffect(() => {
    if (!isCreateOpen && !isEditOpen) {
      return
    }

    const focusField = (id: string) => {
      const element = document.getElementById(id) as HTMLElement | null
      element?.focus()
    }

    const fieldMap = isEditOpen
      ? {
        Digit1: 'transaction-edit-account',
        Digit2: 'transaction-edit-category',
        Digit3: 'transaction-edit-subcategory',
        Digit4: 'transaction-edit-date',
        Digit5: 'transaction-edit-amount',
        Digit6: 'transaction-edit-description',
        Digit7: 'transaction-edit-notes',
        Numpad1: 'transaction-edit-account',
        Numpad2: 'transaction-edit-category',
        Numpad3: 'transaction-edit-subcategory',
        Numpad4: 'transaction-edit-date',
        Numpad5: 'transaction-edit-amount',
        Numpad6: 'transaction-edit-description',
        Numpad7: 'transaction-edit-notes',
      }
      : {
        Digit1: 'transaction-account',
        Digit2: 'transaction-category',
        Digit3: 'transaction-subcategory',
        Digit4: 'transaction-date',
        Digit5: 'transaction-amount',
        Digit6: 'transaction-description',
        Digit7: 'transaction-notes',
        Numpad1: 'transaction-account',
        Numpad2: 'transaction-category',
        Numpad3: 'transaction-subcategory',
        Numpad4: 'transaction-date',
        Numpad5: 'transaction-amount',
        Numpad6: 'transaction-description',
        Numpad7: 'transaction-notes',
      }

    const handleModalShortcut = (event: KeyboardEvent) => {
      if (!event.altKey || event.metaKey || event.ctrlKey) {
        return
      }
      const keyLookup =
        event.code === 'Digit1' || event.code === 'Digit2' || event.code === 'Digit3' ||
          event.code === 'Digit4' || event.code === 'Digit5' || event.code === 'Digit6' ||
          event.code === 'Digit7' || event.code === 'Numpad1' || event.code === 'Numpad2' ||
          event.code === 'Numpad3' || event.code === 'Numpad4' || event.code === 'Numpad5' ||
          event.code === 'Numpad6' || event.code === 'Numpad7'
          ? event.code
          : event.key
      const fieldId = fieldMap[keyLookup as keyof typeof fieldMap]
      if (!fieldId) {
        return
      }
      event.preventDefault()
      focusField(fieldId)
    }

    window.addEventListener('keydown', handleModalShortcut, true)
    return () => {
      window.removeEventListener('keydown', handleModalShortcut, true)
    }
  }, [isCreateOpen, isEditOpen])

  useEffect(() => {
    if (isDeleteConfirmOpen) {
      deleteModalRef.current?.focus()
      return
    }
    if (isBulkDeleteOpen) {
      bulkDeleteModalRef.current?.focus()
      return
    }
    if (selectedTransaction && !isEditOpen) {
      detailModalRef.current?.focus()
    }
  }, [isDeleteConfirmOpen, isBulkDeleteOpen, isEditOpen, selectedTransaction])

  useEffect(() => {
    const hasOpenModal =
      isCreateOpen ||
      isTransferOpen ||
      isEditOpen ||
      isDeleteConfirmOpen ||
      isBulkDeleteOpen ||
      !!selectedTransaction
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
      if (isBulkDeleteOpen) {
        setIsBulkDeleteOpen(false)
        return
      }

      if (isTransferOpen) {
        setIsTransferOpen(false)
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
    isTransferOpen,
    isEditOpen,
    isDeleteConfirmOpen,
    isBulkDeleteOpen,
    selectedTransaction,
  ])

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey) {
        return
      }
      const key = event.key?.toLowerCase()
      const keyCode = (event as KeyboardEvent & { keyCode?: number }).keyCode
      if (key !== 'n' && event.code !== 'KeyN' && keyCode !== 78) {
        return
      }
      const target = event.target as HTMLElement | null
      const tagName = target?.tagName?.toLowerCase()
      if (
        tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select' ||
        target?.isContentEditable
      ) {
        return
      }
      event.preventDefault()
      setIsCreateOpen(true)
    }

    window.addEventListener('keydown', handleShortcut, true)
    return () => {
      window.removeEventListener('keydown', handleShortcut, true)
    }
  }, [])

  useEffect(() => {
    setDescriptionDraft(descriptionFilter)
  }, [descriptionFilter])

  const handleCopyValue = async (
    value: number,
    label: 'average' | 'total',
  ) => {
    const formatted = formatCurrencyValue(value)
    if (!navigator?.clipboard?.writeText) {
      return
    }
    try {
      await navigator.clipboard.writeText(formatted)
      setCopiedValue(label)
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current)
      }
      copyTimeoutRef.current = window.setTimeout(() => {
        setCopiedValue(null)
      }, 1500)
    } catch {
      // ignore clipboard errors
    }
  }

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current)
      }
      if (detailCopyTimeoutRef.current) {
        window.clearTimeout(detailCopyTimeoutRef.current)
      }
    }
  }, [])

  const handleCopyDetail = async (
    value: string,
    field: 'description' | 'amount',
  ) => {
    if (!navigator?.clipboard?.writeText) {
      return
    }
    try {
      await navigator.clipboard.writeText(value)
      setDetailCopiedField(field)
      if (detailCopyTimeoutRef.current) {
        window.clearTimeout(detailCopyTimeoutRef.current)
      }
      detailCopyTimeoutRef.current = window.setTimeout(() => {
        setDetailCopiedField(null)
      }, 1500)
    } catch {
      // ignore clipboard errors
    }
  }

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
    setSelectedIds((prev) => {
      if (prev.size === 0) {
        return prev
      }
      const idsOnPage = new Set(transactions.map((transaction) => transaction.id))
      const next = new Set<string>()
      prev.forEach((id) => {
        if (idsOnPage.has(id)) {
          next.add(id)
        }
      })
      return next
    })
  }, [transactions])

  useEffect(() => {
    if (!selectAllRef.current) {
      return
    }
    selectAllRef.current.indeterminate =
      hasSelection && !allSelected
  }, [allSelected, hasSelection])

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

  const handleOpenDuplicate = (transaction: Transaction) => {
    if (transaction.transferId) {
      return
    }
    reset({
      accountId: transaction.accountId,
      categoryId: transaction.categoryId,
      subcategoryId: transaction.subcategoryId ?? '',
      type: transaction.type,
      amount: `$ ${formatCurrencyValue(transaction.amount)}`,
      date: formatDateInput(new Date()),
      description: transaction.description ?? '',
      notes: transaction.notes ?? '',
    })
    setSelectedTransaction(null)
    setIsCreateOpen(true)
  }

  const handleCloseTransferModal = () => {
    setIsTransferOpen(false)
    setTransferEditContext(null)
    setTransferEditError(null)
    transferForm.reset()
  }

  const handleSwapTransferAccounts = () => {
    const fromAccountId = transferForm.getValues('fromAccountId')
    const toAccountId = transferForm.getValues('toAccountId')
    transferForm.setValue('fromAccountId', toAccountId)
    transferForm.setValue('toAccountId', fromAccountId)
  }

  const findTransferCounterpart = async (transaction: Transaction) => {
    if (!transaction.transferId) {
      return null
    }
    const localMatch = transactions.find(
      (item) =>
        item.transferId === transaction.transferId &&
        item.id !== transaction.id,
    )
    if (localMatch) {
      return localMatch
    }
    const limit = 100
    let page = 1
    let totalPages = 1

    while (page <= totalPages) {
      const response = await api.get<TransactionsListResponse>(
        '/transactions',
        {
          params: {
            page,
            limit,
            startDate: transaction.date,
            endDate: transaction.date,
          },
        },
      )
      const result = response.data
      totalPages = Math.max(1, Math.ceil(result.total / result.limit))
      const match = result.data.find(
        (item) =>
          item.transferId === transaction.transferId &&
          item.id !== transaction.id,
      )
      if (match) {
        return match
      }
      page += 1
    }

    return null
  }

  const handleOpenRepeatTransfer = async (transaction: Transaction) => {
    if (!transaction.transferId) {
      return
    }
    if (isRepeatTransferLoading) {
      return
    }
    setTransferEditContext(null)
    setRepeatTransferError(null)
    setIsRepeatTransferLoading(true)
    try {
      const relatedTransfer = await findTransferCounterpart(transaction)
      if (!relatedTransfer) {
        setRepeatTransferError(
          'Não foi possível localizar a outra conta da transferência.',
        )
        return
      }
      const isExpense = transaction.type === 'expense'
      const fromAccountId = isExpense
        ? transaction.accountId
        : relatedTransfer.accountId
      const toAccountId = isExpense
        ? relatedTransfer.accountId
        : transaction.accountId

      if (!fromAccountId || !toAccountId) {
        setRepeatTransferError(
          'Não foi possível definir as contas da transferência.',
        )
        return
      }

      transferForm.reset({
        fromAccountId,
        toAccountId,
        amount: `$ ${formatCurrencyValue(transaction.amount)}`,
        date: formatDateInput(new Date()),
        description: transaction.description ?? '',
      })
      setSelectedTransaction(null)
      setIsTransferOpen(true)
    } catch (error: unknown) {
      setRepeatTransferError(
        getApiErrorMessage(error, {
          defaultMessage:
            'Erro ao carregar os dados da transferência. Tente novamente.',
        }),
      )
    } finally {
      setIsRepeatTransferLoading(false)
    }
  }

  const handleOpenEditTransfer = async (transaction: Transaction) => {
    if (!transaction.transferId) {
      return
    }
    if (isEditTransferLoading) {
      return
    }
    setTransferEditError(null)
    setIsEditTransferLoading(true)
    try {
      const relatedTransfer = await findTransferCounterpart(transaction)
      if (!relatedTransfer) {
        setTransferEditError(
          'Não foi possível localizar a outra conta da transferência.',
        )
        return
      }
      const isExpense = transaction.type === 'expense'
      const expenseTransaction = isExpense ? transaction : relatedTransfer
      const incomeTransaction = isExpense ? relatedTransfer : transaction

      setTransferEditContext({
        expenseId: expenseTransaction.id,
        incomeId: incomeTransaction.id,
      })

      transferForm.reset({
        fromAccountId: expenseTransaction.accountId,
        toAccountId: incomeTransaction.accountId,
        amount: `$ ${formatCurrencyValue(transaction.amount)}`,
        date: transaction.date,
        description: transaction.description ?? '',
      })
      setSelectedTransaction(null)
      setIsTransferOpen(true)
    } catch (error: unknown) {
      setTransferEditError(
        getApiErrorMessage(error, {
          defaultMessage:
            'Erro ao carregar os dados da transferência. Tente novamente.',
        }),
      )
    } finally {
      setIsEditTransferLoading(false)
    }
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
          <h2 className="text-xl font-bold">Transações</h2>
          <p className="text-sm text-muted-foreground">
            Acompanhe receitas e despesas registradas nas contas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setTransferEditContext(null)
              setTransferEditError(null)
              setIsTransferOpen(true)
            }}
          >
            Nova transferência
          </Button>
          <Button onClick={() => setIsCreateOpen(true)} title="Atalho: N">
            Nova transação
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <h3 className="text-sm font-semibold">Filtros</h3>
          <div className="flex flex-1 items-center gap-2">
            <Input
              id="filter-description"
              placeholder="Buscar por descrição"
              value={descriptionDraft}
              className="bg-background dark:bg-muted/50"
              onChange={(event) => setDescriptionDraft(event.target.value)}
            />
            <div className="flex items-center gap-1.5">
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearFilters}
                >
                  Limpar filtros
                </Button>
              )}
              <Button
                variant="default"
                size="sm"
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
              <div className="flex flex-wrap items-center gap-4">
                <label
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                  title={
                    canSearchNotes
                      ? undefined
                      : 'Informe uma descrição para buscar nas notas'
                  }
                >
                  <input
                    id="filter-include-notes"
                    type="checkbox"
                    className="h-4 w-4"
                    checked={includeNotes}
                    disabled={!canSearchNotes}
                    onChange={(event) =>
                      navigate({
                        search: (prev) => ({
                          ...prev,
                          includeNotes: event.target.checked ? true : undefined,
                          notesOnly: event.target.checked ? prev.notesOnly : undefined,
                          page: 1,
                        }),
                      })
                    }
                  />
                  Buscar nas notas
                </label>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    id="filter-notes-only"
                    type="checkbox"
                    className="h-4 w-4"
                    checked={notesOnly}
                    disabled={!canSearchNotes}
                    onChange={(event) =>
                      navigate({
                        search: (prev) => ({
                          ...prev,
                          notesOnly: event.target.checked ? true : undefined,
                          includeNotes: event.target.checked ? true : prev.includeNotes,
                          page: 1,
                        }),
                      })
                    }
                  />
                  Somente notas
                </label>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-start-date">Data inicial</Label>
              <Input
                id="filter-start-date"
                type="date"
                value={startDateFilter}
                className="bg-background dark:bg-muted/50"
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
                className="bg-background dark:bg-muted/50"
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
                className="h-10 w-full rounded-md border bg-background px-3 text-sm dark:bg-muted/50"
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
                className="h-10 w-full rounded-md border bg-background px-3 text-sm dark:bg-muted/50"
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
                className="h-10 w-full rounded-md border bg-background px-3 text-sm dark:bg-muted/50"
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
                className="h-10 w-full rounded-md border bg-background px-3 text-sm dark:bg-muted/50"
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

      {selectedCount >= 2 && (
        <div className="rounded-lg border bg-card px-4 py-2 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setBulkDeleteError(null)
                  setIsBulkDeleteOpen(true)
                }}
                disabled={isBulkDeleting}
              >
                Excluir
              </Button>
              <div className="font-medium">
                Selecionadas: {selectedCount}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-5 text-right">
              <div>
                Média:{' '}
                <span
                  className={`sensitive cursor-pointer font-semibold ${amountTone(
                    selectedAverage,
                  )}`}
                  role="button"
                  tabIndex={0}
                  title="Clique para copiar"
                  onClick={() => handleCopyValue(selectedAverage, 'average')}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      handleCopyValue(selectedAverage, 'average')
                    }
                  }}
                >
                  {formatCurrencyValue(selectedAverage)}
                </span>
                {copiedValue === 'average' && (
                  <span className="ml-2 text-[11px] text-muted-foreground">
                    Copiado!
                  </span>
                )}
              </div>
              <div>
                Soma:{' '}
                <span
                  className={`sensitive cursor-pointer font-semibold ${amountTone(
                    selectedTotal,
                  )}`}
                  role="button"
                  tabIndex={0}
                  title="Clique para copiar"
                  onClick={() => handleCopyValue(selectedTotal, 'total')}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      handleCopyValue(selectedTotal, 'total')
                    }
                  }}
                >
                  {formatCurrencyValue(selectedTotal)}
                </span>
                {copiedValue === 'total' && (
                  <span className="ml-2 text-[11px] text-muted-foreground">
                    Copiado!
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border">
        <div className="max-h-[520px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-[11px] uppercase text-muted-foreground">
              <tr>
                <th className="w-12 px-4 py-2 text-center">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    className="h-4 w-4 cursor-pointer"
                    checked={allSelected}
                    onChange={(event) => {
                      if (event.target.checked) {
                        setSelectedIds(
                          new Set(
                            transactions.map((transaction) => transaction.id),
                          ),
                        )
                        return
                      }
                      setSelectedIds(new Set())
                    }}
                    aria-label="Selecionar todas as transações"
                  />
                </th>
                <th className="px-4 py-2">
                  <button
                    className="inline-flex items-center gap-2 text-left"
                    type="button"
                    onClick={() => handleSort('date')}
                  >
                    Data
                    <SortIcon
                      isActive={sortKey === 'date'}
                      direction={sortDirection}
                    />
                  </button>
                </th>
                <th className="px-4 py-2">
                  <button
                    className="inline-flex items-center gap-2 text-left"
                    type="button"
                    onClick={() => handleSort('description')}
                  >
                    Descrição
                    <SortIcon
                      isActive={sortKey === 'description'}
                      direction={sortDirection}
                    />
                  </button>
                </th>
                <th className="px-4 py-2">
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
                <th className="px-4 py-2">
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
                <th className="px-4 py-2">
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
                <th className="px-4 py-2 text-center">
                  <button
                    className="inline-flex items-center gap-2 text-center"
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
                <th className="px-4 py-2 text-right">
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
                  <td className="px-4 py-5 text-muted-foreground" colSpan={8}>
                    Carregando transações...
                  </td>
                </tr>
              )}
              {!transactionsQuery.isLoading && transactions.length === 0 && (
                <tr>
                  <td className="px-4 py-5 text-muted-foreground" colSpan={8}>
                    Nenhuma transação encontrada.
                  </td>
                </tr>
              )}
              {transactions.map((transaction) => (
                <tr
                  key={transaction.id}
                  className="cursor-pointer border-t hover:bg-muted/30"
                  onClick={() => {
                    setDeleteError(null)
                    setRepeatTransferError(null)
                    setTransferEditError(null)
                    setSelectedTransaction(transaction)
                  }}
                >
                  <td
                    className="cursor-pointer px-4 py-2 text-center"
                    onClick={(event) => {
                      event.stopPropagation()
                      setSelectedIds((prev) => {
                        const next = new Set(prev)
                        if (next.has(transaction.id)) {
                          next.delete(transaction.id)
                        } else {
                          next.add(transaction.id)
                        }
                        return next
                      })
                    }}
                    onMouseDown={(event) => event.stopPropagation()}
                  >
                    <label
                      htmlFor={`transaction-select-${transaction.id}`}
                      className="flex h-full w-full cursor-pointer items-center justify-center rounded-md p-1.5 hover:bg-muted/40"
                      onClick={(event) => event.stopPropagation()}
                      onMouseDown={(event) => event.stopPropagation()}
                    >
                      <input
                        id={`transaction-select-${transaction.id}`}
                        type="checkbox"
                        className="h-4 w-4 cursor-pointer"
                        checked={selectedIds.has(transaction.id)}
                        onClick={(event) => event.stopPropagation()}
                        onMouseDown={(event) => event.stopPropagation()}
                        onChange={(event) => {
                          setSelectedIds((prev) => {
                            const next = new Set(prev)
                            if (event.target.checked) {
                              next.add(transaction.id)
                            } else {
                              next.delete(transaction.id)
                            }
                            return next
                          })
                        }}
                        aria-label="Selecionar transação"
                      />
                    </label>
                  </td>
                  <td className="px-4 py-2">
                    {dateFormatter.format(new Date(transaction.date))}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span>
                        {transaction.description ||
                          transaction.categoryName ||
                          categoryMap.get(transaction.categoryId) ||
                          'Sem descrição'}
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
                  <td className="px-4 py-2">
                    {transaction.accountName ||
                      accountMap.get(transaction.accountId) ||
                      '-'}
                  </td>
                  <td className="px-4 py-2">
                    {transaction.categoryName ||
                      categoryMap.get(transaction.categoryId) ||
                      '-'}
                  </td>
                  <td className="px-4 py-2">
                    {transaction.subcategoryId
                      ? transaction.subcategoryName || '-'
                      : '-'}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span
                      className={
                        transaction.type === 'income'
                          ? 'rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700'
                          : 'rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700'
                      }
                    >
                      {transaction.type === 'income' ? 'Receita' : 'Despesa'}
                    </span>
                  </td>
                  <td
                    className={
                      transaction.type === 'income'
                        ? 'sensitive px-4 py-2 text-right font-medium text-emerald-600'
                        : transaction.type === 'expense'
                          ? 'sensitive px-4 py-2 text-right font-medium text-rose-600'
                          : 'sensitive px-4 py-2 text-right font-medium text-muted-foreground'
                    }
                  >
                    {formatCurrencyValue(transaction.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t bg-card px-4 py-2 text-xs">
          <span className="text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <div className="flex items-center gap-3">
            <select
              className="h-8 rounded-md border bg-background px-2 text-xs dark:border-muted/80"
              value={limit}
              onChange={(event) =>
                navigate({
                  search: (prev) => ({
                    ...prev,
                    limit: Number(event.target.value),
                    page: 1,
                  }),
                })
              }
              aria-label="Quantidade de linhas"
            >
              {[10, 20, 30, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() =>
                  navigate({
                    search: (prev) => ({
                      ...prev,
                      page: Math.max(1, page - 1),
                    }),
                  })
                }
                aria-label="Página anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {paginationItems.map((item, index) =>
                item === '...' ? (
                  <span
                    key={`pagination-ellipsis-${index}`}
                    className="px-1 text-muted-foreground"
                  >
                    ...
                  </span>
                ) : (
                  <Button
                    key={`pagination-page-${item}`}
                    variant={item === page ? 'default' : 'outline'}
                    size="sm"
                    onClick={() =>
                      navigate({
                        search: (prev) => ({
                          ...prev,
                          page: item,
                        }),
                      })
                    }
                  >
                    {item}
                  </Button>
                ),
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() =>
                  navigate({
                    search: (prev) => ({
                      ...prev,
                      page: Math.min(totalPages, page + 1),
                    }),
                  })
                }
                aria-label="Próxima página"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="fixed inset-0"
            onClick={() => setIsCreateOpen(false)}
          />
          <div className="relative w-full max-w-2xl rounded-lg border bg-background p-6 shadow-lg">
            <div>
              <h3 className="text-lg font-semibold">Nova transação</h3>
              <p className="text-sm text-muted-foreground">
                Preencha os dados para registrar uma nova transação.
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
                        'Erro ao criar transação. Tente novamente.',
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
                    tabIndex={7}
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
                    onFocus={handleDateFocus}
                    tabIndex={6}
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
                    tabIndex={4}
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
                    tabIndex={5}
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
                  <input type="hidden" {...register('type')} />
                  <Input
                    id="transaction-type"
                    className="h-10 cursor-not-allowed bg-muted/30"
                    readOnly
                    tabIndex={-1}
                    placeholder="Receita/Despesa"
                    aria-invalid={!!errors.type}
                    value={
                      createType === 'income'
                        ? 'Receita'
                        : createType === 'expense'
                          ? 'Despesa'
                          : ''
                    }
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
                        tabIndex={3}
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
                <Label htmlFor="transaction-description">Descrição</Label>
                {(() => {
                  const descriptionRegister = register('description')
                  return (
                    <div className="relative">
                      <Input
                        id="transaction-description"
                        placeholder="Ex: Supermercado"
                        className="h-10"
                        aria-invalid={!!errors.description}
                        {...descriptionRegister}
                        ref={(element) => {
                          descriptionRegister.ref(element)
                          descriptionInputRef.current = element
                        }}
                        onFocus={() => {
                          setIsDescriptionFocused(true)
                          setIsDescriptionSuggestionsOpen(true)
                        }}
                        onBlur={(event) => {
                          descriptionRegister.onBlur(event)
                          setIsDescriptionFocused(false)
                          setIsDescriptionSuggestionsOpen(false)
                        }}
                        onChange={(event) => {
                          descriptionRegister.onChange(event)
                          if (
                            isDescriptionFocused &&
                            event.target.value.includes(' ')
                          ) {
                            setIsDescriptionSuggestionsOpen(true)
                          }
                        }}
                        onKeyDown={(event) => {
                          if (!isDescriptionSuggestionsOpen) {
                            return
                          }
                          if (event.key === 'ArrowDown') {
                            event.preventDefault()
                            setActiveSuggestionIndex((prev) =>
                              Math.min(
                                prev + 1,
                                Math.max(0, descriptionSuggestions.length - 1),
                              ),
                            )
                          }
                          if (event.key === 'ArrowUp') {
                            event.preventDefault()
                            setActiveSuggestionIndex((prev) =>
                              Math.max(prev - 1, 0),
                            )
                          }
                          if (event.key === 'Enter') {
                            if (descriptionSuggestions.length === 0) {
                              return
                            }
                            event.preventDefault()
                            const selected =
                              descriptionSuggestions[activeSuggestionIndex]
                            if (!selected) {
                              return
                            }
                            setValue('description', selected, {
                              shouldDirty: true,
                              shouldTouch: true,
                            })
                            setIsDescriptionSuggestionsOpen(false)
                          }
                          if (event.key === 'Escape') {
                            setIsDescriptionSuggestionsOpen(false)
                          }
                        }}
                        autoComplete="off"
                        tabIndex={1}
                      />
                      {isDescriptionSuggestionsOpen && (
                        <div className="absolute z-10 mt-1 w-full rounded-md border bg-background shadow-lg">
                          {filteredDescriptionSuggestionsQuery.isLoading ||
                            baseDescriptionSuggestionsQuery.isLoading ? (
                            <div className="px-3 py-2 text-sm text-muted-foreground">
                              {shouldFilterSuggestions
                                ? 'Buscando sugestões...'
                                : 'Carregando sugestões...'}
                            </div>
                          ) : filteredDescriptionSuggestionsQuery.isError ||
                            baseDescriptionSuggestionsQuery.isError ? (
                            <div className="px-3 py-2 text-sm text-destructive">
                              Erro ao carregar sugestões.
                            </div>
                          ) : descriptionSuggestions.length > 0 ? (
                            descriptionSuggestions.map((suggestion) => (
                              <button
                                key={suggestion}
                                type="button"
                                className={`flex w-full items-center px-3 py-2 text-left text-sm ${suggestion === descriptionSuggestions[activeSuggestionIndex]
                                  ? 'bg-muted/60'
                                  : 'hover:bg-muted/40'
                                  }`}
                                onMouseDown={(event) => {
                                  event.preventDefault()
                                  setValue('description', suggestion, {
                                    shouldDirty: true,
                                    shouldTouch: true,
                                  })
                                  setIsDescriptionSuggestionsOpen(false)
                                  window.requestAnimationFrame(() => {
                                    descriptionInputRef.current?.focus()
                                  })
                                }}
                              >
                                {suggestion}
                              </button>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-sm text-muted-foreground">
                              Nenhuma sugestão encontrada.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })()}
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
                  tabIndex={2}
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

      {isTransferOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="fixed inset-0"
            onClick={handleCloseTransferModal}
          />
          <div className="relative w-full max-w-2xl rounded-lg border bg-background p-6 shadow-lg">
            <div>
              <h3 className="text-lg font-semibold">
                {transferEditContext
                  ? 'Editar transferência'
                  : 'Nova transferência'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {transferEditContext
                  ? 'Atualize os dados da transferência selecionada.'
                  : 'Informe as contas de origem e destino.'}
              </p>
            </div>

            <form
              className="mt-6 space-y-4"
              onSubmit={transferForm.handleSubmit(async (formData) => {
                try {
                  const parsedAmount =
                    parseCurrencyInput(formData.amount) ?? 0
                  if (transferEditContext) {
                    await Promise.all([
                      updateTransactionMutation.mutateAsync({
                        id: transferEditContext.expenseId,
                        payload: {
                          accountId: formData.fromAccountId,
                          amount: parsedAmount,
                          date: formData.date,
                          description: formData.description?.trim() || null,
                        },
                      }),
                      updateTransactionMutation.mutateAsync({
                        id: transferEditContext.incomeId,
                        payload: {
                          accountId: formData.toAccountId,
                          amount: parsedAmount,
                          date: formData.date,
                          description: formData.description?.trim() || null,
                        },
                      }),
                    ])
                  } else {
                    await createTransferMutation.mutateAsync({
                      fromAccountId: formData.fromAccountId,
                      toAccountId: formData.toAccountId,
                      amount: parsedAmount,
                      date: formData.date,
                      description: formData.description?.trim() || null,
                    })
                  }
                  handleCloseTransferModal()
                } catch (error: unknown) {
                  transferForm.setError('root', {
                    message: getApiErrorMessage(error, {
                      defaultMessage:
                        transferEditContext
                          ? 'Erro ao atualizar transferência. Tente novamente.'
                          : 'Erro ao criar transferência. Tente novamente.',
                    }),
                  })
                }
              })}
            >
              <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
                <div className="space-y-2">
                  <Label htmlFor="transfer-from-account">Conta de origem</Label>
                  <select
                    id="transfer-from-account"
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    aria-invalid={
                      !!transferForm.formState.errors.fromAccountId
                    }
                    {...transferForm.register('fromAccountId')}
                  >
                    <option value="">Selecione</option>
                    {(accountsQuery.data ?? []).map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                  {transferForm.formState.errors.fromAccountId && (
                    <p className="text-sm text-destructive">
                      {transferForm.formState.errors.fromAccountId.message}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-center sm:pb-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 w-9 p-0"
                    title="Inverter contas"
                    aria-label="Inverter contas"
                    onClick={handleSwapTransferAccounts}
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="transfer-to-account">Conta de destino</Label>
                  <select
                    id="transfer-to-account"
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    aria-invalid={
                      !!transferForm.formState.errors.toAccountId
                    }
                    {...transferForm.register('toAccountId')}
                  >
                    <option value="">Selecione</option>
                    {(accountsQuery.data ?? []).map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                  {transferForm.formState.errors.toAccountId && (
                    <p className="text-sm text-destructive">
                      {transferForm.formState.errors.toAccountId.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="transfer-date">Data</Label>
                  <Input
                    id="transfer-date"
                    type="date"
                    className="h-10"
                    aria-invalid={!!transferForm.formState.errors.date}
                    onFocus={handleDateFocus}
                    {...transferForm.register('date')}
                  />
                  {transferForm.formState.errors.date && (
                    <p className="text-sm text-destructive">
                      {transferForm.formState.errors.date.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="transfer-amount">Valor</Label>
                  <Controller
                    control={transferForm.control}
                    name="amount"
                    render={({ field }) => (
                      <Input
                        id="transfer-amount"
                        type="text"
                        inputMode="numeric"
                        placeholder="$ 0,00"
                        className="h-10"
                        ref={transferAmountRef}
                        value={field.value}
                        onChange={(event) =>
                          field.onChange(
                            formatCurrencyInput(event.target.value),
                          )
                        }
                        aria-invalid={!!transferForm.formState.errors.amount}
                      />
                    )}
                  />
                  {transferForm.formState.errors.amount && (
                    <p className="text-sm text-destructive">
                      {transferForm.formState.errors.amount.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="transfer-description">Descrição</Label>
                <Input
                  id="transfer-description"
                  placeholder="Opcional"
                  className="h-10"
                  aria-invalid={!!transferForm.formState.errors.description}
                  {...transferForm.register('description')}
                />
                {transferForm.formState.errors.description && (
                  <p className="text-sm text-destructive">
                    {transferForm.formState.errors.description.message}
                  </p>
                )}
              </div>

              {transferForm.formState.errors.root && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {transferForm.formState.errors.root.message}
                </div>
              )}

              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseTransferModal}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={transferForm.formState.isSubmitting}
                >
                  {transferEditContext ? 'Salvar' : 'Transferir'}
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
              <h3 className="text-lg font-semibold">Detalhes da transação</h3>
              <p className="text-sm text-muted-foreground">
                Informações da transação selecionada.
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
                <span className="text-muted-foreground">Descrição</span>
                <span className="relative">
                  <button
                    type="button"
                    className="cursor-pointer font-medium hover:underline"
                    onClick={() =>
                      handleCopyDetail(
                        selectedTransaction.description ||
                          categoryMap.get(selectedTransaction.categoryId) ||
                          'Sem descrição',
                        'description',
                      )
                    }
                  >
                    {selectedTransaction.description ||
                      categoryMap.get(selectedTransaction.categoryId) ||
                      'Sem descrição'}
                  </button>
                  {detailCopiedField === 'description' && (
                    <span className="absolute -top-6 right-0 rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground shadow-sm">
                      Copiado!
                    </span>
                  )}
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
                <span className="relative">
                  <button
                    type="button"
                    className="sensitive cursor-pointer font-semibold hover:underline"
                    onClick={() =>
                      handleCopyDetail(
                        formatCurrencyValue(selectedTransaction.amount),
                        'amount',
                      )
                    }
                  >
                    {formatCurrencyValue(selectedTransaction.amount)}
                  </button>
                  {detailCopiedField === 'amount' && (
                    <span className="absolute -top-6 right-0 rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground shadow-sm">
                      Copiado!
                    </span>
                  )}
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
              <div className="flex w-full flex-col items-end gap-3">
                {repeatTransferError && (
                  <p className="text-sm text-destructive">
                    {repeatTransferError}
                  </p>
                )}
                {transferEditError && (
                  <p className="text-sm text-destructive">
                    {transferEditError}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  {selectedTransaction.transferId ? (
                    <Button
                      variant="outline"
                      disabled={isRepeatTransferLoading}
                      aria-busy={isRepeatTransferLoading}
                      onClick={() =>
                        handleOpenRepeatTransfer(selectedTransaction)
                      }
                    >
                      {isRepeatTransferLoading ? 'Carregando...' : 'Repetir'}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => handleOpenDuplicate(selectedTransaction)}
                    >
                      Duplicar
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    autoFocus
                    disabled={
                      selectedTransaction.transferId && isEditTransferLoading
                    }
                    aria-busy={
                      selectedTransaction.transferId && isEditTransferLoading
                    }
                    onClick={() => {
                      if (selectedTransaction.transferId) {
                        handleOpenEditTransfer(selectedTransaction)
                      } else {
                        handleOpenEdit(selectedTransaction)
                      }
                    }}
                  >
                    {selectedTransaction.transferId && isEditTransferLoading
                      ? 'Carregando...'
                      : 'Editar'}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleOpenDelete(selectedTransaction)}
                  >
                    Excluir
                  </Button>
                </div>
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
              <h3 className="text-lg font-semibold">Editar transação</h3>
              <p className="text-sm text-muted-foreground">
                Atualize os dados da transação selecionada.
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
                        'Erro ao atualizar transação. Tente novamente.',
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
                    tabIndex={7}
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
                    onFocus={handleDateFocus}
                    tabIndex={6}
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
                    tabIndex={4}
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
                    tabIndex={5}
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
                  <input type="hidden" {...editRegister('type')} />
                  <Input
                    id="transaction-edit-type"
                    className="h-10 cursor-not-allowed bg-muted/30"
                    readOnly
                    tabIndex={-1}
                    placeholder="Receita/Despesa"
                    aria-invalid={!!editErrors.type}
                    value={
                      editType === 'income'
                        ? 'Receita'
                        : editType === 'expense'
                          ? 'Despesa'
                          : ''
                    }
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
                        tabIndex={3}
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
                  Descrição
                </Label>
                <Input
                  id="transaction-edit-description"
                  placeholder="Ex: Supermercado"
                  className="h-10"
                  aria-invalid={!!editErrors.description}
                  tabIndex={1}
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
                  tabIndex={2}
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
                Tem certeza que deseja excluir esta transação? Essa ação não
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
                          'Erro ao excluir transação. Tente novamente.',
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

      {isBulkDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="fixed inset-0"
            onClick={() => setIsBulkDeleteOpen(false)}
          />
          <div
            className="relative w-full max-w-md rounded-lg border bg-background p-6 shadow-lg"
            ref={bulkDeleteModalRef}
            tabIndex={-1}
          >
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Confirmar exclusão</h3>
              <p className="text-sm text-muted-foreground">
                Tem certeza que deseja excluir {selectedCount} transações
                selecionadas? Essa ação não pode ser desfeita.
              </p>
            </div>

            {bulkDeleteError && (
              <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {bulkDeleteError}
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsBulkDeleteOpen(false)}
                disabled={isBulkDeleting}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  const idsArray = buildBulkDeleteIds(selectedTransactions)
                  if (idsArray.length === 0) {
                    setIsBulkDeleteOpen(false)
                    return
                  }
                  setIsBulkDeleting(true)
                  setBulkDeleteError(null)
                  try {
                    const results = await Promise.allSettled(
                      idsArray.map((id) =>
                        deleteTransactionMutation.mutateAsync(id),
                      ),
                    )
                    const hasError = results.some(
                      (result) => result.status === 'rejected',
                    )
                    if (hasError) {
                      setBulkDeleteError(
                        'Erro ao excluir transações. Tente novamente.',
                      )
                      return
                    }
                    setIsBulkDeleteOpen(false)
                    setSelectedIds(new Set())
                  } catch (error: unknown) {
                    setBulkDeleteError(
                      getApiErrorMessage(error, {
                        defaultMessage:
                          'Erro ao excluir transações. Tente novamente.',
                      }),
                    )
                  } finally {
                    setIsBulkDeleting(false)
                  }
                }}
                disabled={isBulkDeleting}
              >
                {isBulkDeleting ? 'Excluindo...' : 'Excluir'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function buildPaginationItems(current: number, total: number) {
  if (total <= 1) {
    return [1]
  }

  const items: Array<number | '...'> = []
  const add = (value: number | '...') => items.push(value)
  const siblings = 1

  const showLeftEllipsis = current > 2 + siblings
  const showRightEllipsis = current < total - (1 + siblings)

  add(1)

  if (showLeftEllipsis) {
    add('...')
  }

  const start = Math.max(2, current - siblings)
  const end = Math.min(total - 1, current + siblings)

  for (let page = start; page <= end; page += 1) {
    add(page)
  }

  if (showRightEllipsis) {
    add('...')
  }

  if (total > 1) {
    add(total)
  }

  return items
}

function formatDateInput(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
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
