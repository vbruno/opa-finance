// @ts-nocheck
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import {
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEventHandler,
} from 'react'
import {
  useForm,
  type ControllerRenderProps,
} from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAccounts } from '@/features/accounts'
import {
  fetchSubcategories,
  useCategories,
  useCreateCategory,
  useCreateSubcategory,
} from '@/features/categories'
import {
  useCreateRecurrence,
} from '@/features/recurrences'
import {
  buildPaginationItems,
  CATEGORY_TYPE_RANK,
  formatDateDisplay,
  formatDateInput,
  getTransactionAmountToneClass,
  resolveDefaultTransferToAccountId,
  type TransactionsNavigateFn,
  type TransactionsSearchParams,
  useTransactionRecurrenceDraft,
  useTransactionsFilters,
  useTransactionsPagination,
  useTransactionsSearchParams,
  useTransactionsSelection,
  useTransactionsUiState,
  useDebouncedValue,
  useTransactionsCreateSupport,
  useTransactionsInlineCategoryActions,
  useTransactionForm,
  useTransferForm,
  useCreateTransaction,
  useDeleteTransaction,
  useTransactions,
  useUpdateTransaction,
  TransactionsCreateModal,
  TransactionsEditModal,
  TransactionsSortIcon,
  TransactionsDetailsModal,
  TransactionsTableDesktop,
  TransactionsToolbar,
  TransactionsTransferModal,
  TransactionsInlineCategoryFlow,
  TransactionsDeleteConfirmModal,
  TransactionsBulkDeleteModal,
  type Transaction,
} from '@/features/transactions'
import { useCreateTransfer } from '@/features/transfers'
import { useUserPreference } from '@/hooks/useUserPreference'
import { formatCurrencyValue } from '@/lib/utils'
import {
  categoryCreateSchema,
  type CategoryCreateFormData,
} from '@/schemas/category.schema'
import {
  subcategoryCreateSchema,
  type SubcategoryCreateFormData,
} from '@/schemas/subcategory.schema'
import {
  transactionCreateSchema,
  type TransactionCreateFormData,
} from '@/schemas/transaction.schema'
import type { TransactionsTransferModalRequest } from './transactions-transfer-modal'

type TransactionsPageProps = {
  search: TransactionsSearchParams
  navigate: TransactionsNavigateFn
}

export function TransactionsPage({ search, navigate }: TransactionsPageProps) {
  const {
    isCreateOpen,
    setIsCreateOpen,
    isTransferOpen,
    setIsTransferOpen,
    isEditOpen,
    setIsEditOpen,
    isCreateCategoryOpen,
    setIsCreateCategoryOpen,
    isCreateSubcategoryOpen,
    setIsCreateSubcategoryOpen,
    lastCreatedSubcategory,
    setLastCreatedSubcategory,
    pendingCategorySelection,
    pendingSubcategorySelection,
    isDeleteConfirmOpen,
    setIsDeleteConfirmOpen,
    isBulkDeleteOpen,
    setIsBulkDeleteOpen,
    selectedTransaction,
    setSelectedTransaction,
    copiedValue,
    setCopiedValue,
    isDescriptionSuggestionsOpen,
    setIsDescriptionSuggestionsOpen,
    isDescriptionFocused,
    setIsDescriptionFocused,
    activeSuggestionIndex,
    setActiveSuggestionIndex,
    isCreateCategoryTreeOpen,
    setIsCreateCategoryTreeOpen,
    isCreateAccountSelectOpen,
    setIsCreateAccountSelectOpen,
    isEditAccountSelectOpen,
    setIsEditAccountSelectOpen,
    isTransferFromAccountSelectOpen,
    setIsTransferFromAccountSelectOpen,
    isTransferToAccountSelectOpen,
    setIsTransferToAccountSelectOpen,
    createCategoryTreeSearch,
    setCreateCategoryTreeSearch,
    isEditCategoryTreeOpen,
    setIsEditCategoryTreeOpen,
    editCategoryTreeSearch,
    setEditCategoryTreeSearch,
    createCategoryModalTarget,
    setCreateCategoryModalTarget,
    createSubcategoryModalTarget,
    setCreateSubcategoryModalTarget,
    CREATE_CATEGORY_TREE_NONE,
    CREATE_CATEGORY_TREE_CREATE_CATEGORY,
    CREATE_CATEGORY_TREE_CREATE_SUBCATEGORY,
    isFiltersOpen,
    setIsFiltersOpen,
    isCreateMenuOpen,
    setIsCreateMenuOpen,
    createAmountRef,
    transferAmountRef,
    editAmountRef,
    descriptionInputRef,
    dateInputRef,
    createCategorySelectRef,
    createCategoryTreeSearchInputRef,
    createCategoryTreeContentRef,
    editCategoryTreeSearchInputRef,
    editCategoryTreeContentRef,
    subcategoryNameRef,
    categoryNameRef,
    categoryTypeRef,
    selectAllRef,
    copyTimeoutRef,
    lastCreateCategoryId,
    lastEditCategoryId,
    isCreateFromDuplicate,
    isMobile,
    handleMobileDateKeyDown,
    handleMobileDatePaste,
    handleDateClick,
  } = useTransactionsUiState()

  const [createDraftTransaction, setCreateDraftTransaction] =
    useState<Transaction | null>(null)
  const [transferRequest, setTransferRequest] =
    useState<TransactionsTransferModalRequest | null>(null)
  const hasInitializedAccountFilterRef = useRef(false)
  const [limitPreference, setLimitPreference] = useUserPreference<number>(
    'transactionsPageSize',
    30,
    {
      serialize: (value) => String(value),
      deserialize: (raw) => {
        const parsed = Number(raw)
        if (!Number.isFinite(parsed) || parsed <= 0) {
          return 30
        }
        return Math.min(100, Math.max(1, Math.floor(parsed)))
      },
    },
  )
  const {
    page,
    limit,
    typeFilter,
    accountFilter,
    categoryFilter,
    subcategoryFilter,
    includeNotes,
    notesOnly,
    amountMode,
    sortKey,
    sortDirection,
    startDateFilter,
    endDateFilter,
    hasActiveFilters,
    isFilterExpanded,
    setIsFilterExpanded,
    descriptionDraft,
    setDescriptionDraft,
    amountDraft,
    setAmountDraft,
    canSearchNotes,
    isAmountFilterInvalid,
    amountFilterErrorMessage,
    queryParams,
    isQueryEnabled,
    handleClearFilters,
    handleSort,
    setIncludeNotesFilter,
    setNotesOnlyFilter,
    setAmountModeFilter,
    setStartDateFilter,
    setEndDateFilter,
    setTypeFilterValue,
    setAccountFilterValue,
    setCategoryFilterValue,
    setSubcategoryFilterValue,
  } = useTransactionsSearchParams({
    search,
    navigate,
    limitPreference,
  })

  const transactionsQuery = useTransactions(
    queryParams,
    {
      enabled: isQueryEnabled,
    },
  )
  const createTransactionMutation = useCreateTransaction()
  const createRecurrenceMutation = useCreateRecurrence()
  const createTransferMutation = useCreateTransfer()
  const updateTransactionMutation = useUpdateTransaction()
  const deleteTransactionMutation = useDeleteTransaction()
  const createCategoryMutation = useCreateCategory()
  const createSubcategoryMutation = useCreateSubcategory()

  const accountsQuery = useAccounts()
  const categoriesQuery = useCategories()

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    setError,
    setValue,
    clearErrors,
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

  const categoryCreateForm = useForm<CategoryCreateFormData>({
    resolver: zodResolver(categoryCreateSchema),
    defaultValues: {
      name: '',
      type: '',
    },
  })

  const subcategoryCreateForm = useForm<SubcategoryCreateFormData>({
    resolver: zodResolver(subcategoryCreateSchema),
    defaultValues: {
      categoryId: '',
      name: '',
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
    clearErrors: clearEditErrors,
    formState: { errors: editErrors, isSubmitting: isEditSubmitting },
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
  const createSubcategoryId = watch('subcategoryId')
  const createTypeRaw = watch('type')
  const createType: 'income' | 'expense' | '' =
    createTypeRaw === 'income' || createTypeRaw === 'expense'
      ? createTypeRaw
      : ''
  const createAccountId = watch('accountId')
  const createDate = watch('date')
  const {
    isCreateRecurrenceEnabled,
    setIsCreateRecurrenceEnabled,
    createRecurrenceStartDate,
    setCreateRecurrenceStartDate,
    setIsCreateRecurrenceStartDateTouched,
    createRecurrenceFrequency,
    setCreateRecurrenceFrequency,
    createRecurrenceEndType,
    setCreateRecurrenceEndType,
    createRecurrenceEndOccurrences,
    setCreateRecurrenceEndOccurrences,
    createRecurrenceEndDate,
    setCreateRecurrenceEndDate,
    createRecurrenceDayOfWeek,
    setCreateRecurrenceDayOfWeek,
    createRecurrenceDayOfMonth,
    setCreateRecurrenceDayOfMonth,
    createRecurrenceMonthOfYear,
    setCreateRecurrenceMonthOfYear,
    resetCreateRecurrenceDraft,
    recurrenceDraft,
  } = useTransactionRecurrenceDraft({ createDate })
  const createDescription = watch('description') ?? ''
  const editCategoryId = watchEdit('categoryId')
  const editSubcategoryId = watchEdit('subcategoryId')
  const editTypeRaw = watchEdit('type')
  const editType: 'income' | 'expense' | '' =
    editTypeRaw === 'income' || editTypeRaw === 'expense' ? editTypeRaw : ''
  const categories = useMemo(
    () => categoriesQuery.data ?? [],
    [categoriesQuery.data],
  )
  const availableCategories = useMemo(() => {
    const items = categories.filter((category) => !category.system)
    return [...items].sort((a, b) => {
      const typeDiff =
        (CATEGORY_TYPE_RANK[a.type] ?? 99) - (CATEGORY_TYPE_RANK[b.type] ?? 99)
      if (typeDiff !== 0) return typeDiff
      return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
    })
  }, [categories])
  const createCategoryIdsKey = useMemo(
    () => availableCategories.map((category) => category.id).join('|'),
    [availableCategories],
  )
  const accounts = useMemo(
    () => accountsQuery.data ?? [],
    [accountsQuery.data],
  )
  const primaryAccountId =
    accounts.find((account) => account.isPrimary)?.id ?? accounts[0]?.id ?? ''
  const defaultTransferToAccountId = useMemo(
    () => resolveDefaultTransferToAccountId(accounts, primaryAccountId),
    [accounts, primaryAccountId],
  )
  const debouncedCreateDescription = useDebouncedValue(createDescription, 1000)

  useEffect(() => {
    if (hasInitializedAccountFilterRef.current || accountsQuery.isLoading) {
      return
    }
    hasInitializedAccountFilterRef.current = true

    if (search.accountId || !primaryAccountId) {
      return
    }

    navigate({
      search: (prev) => ({
        ...prev,
        accountId: primaryAccountId,
        page: 1,
      }),
      replace: true,
    })
  }, [accountsQuery.isLoading, navigate, primaryAccountId, search.accountId])

  const createCategory = categories.find(
    (category) => category.id === createCategoryId,
  )
  const editCategory = categories.find(
    (category) => category.id === editCategoryId,
  )
  const {
    createSubcategories,
    createSubcategoryName,
    createAccountName,
    createCategoryTreeOptions,
    editCategoryTreeOptions,
    descriptionSuggestions,
    areDescriptionSuggestionsLoading,
    hasDescriptionSuggestionsError,
    shouldFilterSuggestions,
  } = useTransactionsCreateSupport({
    availableCategories,
    createCategoryIdsKey,
    createCategoryId,
    createSubcategoryId: createSubcategoryId ?? '',
    createAccountId,
    createCategoryTreeSearch,
    editCategoryTreeSearch,
    debouncedCreateDescription,
    isCreateOpen,
    isEditOpen,
    lastCreatedSubcategory,
    accounts,
  })
  useEffect(() => {
    setActiveSuggestionIndex(0)
  }, [
    descriptionSuggestions.length,
    isDescriptionSuggestionsOpen,
    setActiveSuggestionIndex,
  ])

  const rawTransactions = useMemo(
    () => transactionsQuery.data?.data ?? [],
    [transactionsQuery.data],
  )
  const transactions = useMemo(
    () => (isAmountFilterInvalid ? [] : rawTransactions),
    [isAmountFilterInvalid, rawTransactions],
  )
  const {
    transferForm,
    transferEditContext,
    transferEditError,
    repeatTransferError,
    isRepeatTransferLoading,
    isEditTransferLoading,
    isTransferRecurrenceEnabled,
    setIsTransferRecurrenceEnabled,
    transferRecurrenceStartDate,
    setTransferRecurrenceStartDate,
    setIsTransferRecurrenceStartDateTouched,
    transferRecurrenceFrequency,
    setTransferRecurrenceFrequency,
    transferRecurrenceEndType,
    setTransferRecurrenceEndType,
    transferRecurrenceEndOccurrences,
    setTransferRecurrenceEndOccurrences,
    transferRecurrenceEndDate,
    setTransferRecurrenceEndDate,
    transferRecurrenceDayOfWeek,
    setTransferRecurrenceDayOfWeek,
    transferRecurrenceDayOfMonth,
    setTransferRecurrenceDayOfMonth,
    transferRecurrenceMonthOfYear,
    setTransferRecurrenceMonthOfYear,
    resetTransferRecurrenceDraft,
    clearTransferFeedback,
    openTransferCreate: legacyOpenTransferCreate,
    handleCloseTransferModal: legacyHandleCloseTransferModal,
    submitTransferForm: legacySubmitTransferForm,
    handleSwapTransferAccounts: legacyHandleSwapTransferAccounts,
    handleOpenRepeatTransfer: legacyHandleOpenRepeatTransfer,
    handleOpenEditTransfer: legacyHandleOpenEditTransfer,
  } = useTransferForm({
    isTransferOpen,
    primaryAccountId,
    defaultTransferToAccountId,
    transactions,
    createTransfer: createTransferMutation.mutateAsync,
    createRecurrence: createRecurrenceMutation.mutateAsync,
    deleteTransaction: deleteTransactionMutation.mutateAsync,
    updateTransaction: updateTransactionMutation.mutateAsync,
    onTransferModalOpen: () => {
      setIsTransferOpen(true)
    },
    onTransferModalClose: () => {
      setIsTransferFromAccountSelectOpen(false)
      setIsTransferToAccountSelectOpen(false)
      setIsTransferOpen(false)
    },
    onTransactionDetailsClose: () => {
      setSelectedTransaction(null)
    },
  })
  const {
    selectedIds,
    selectedTransactions,
    selectedCount,
    allSelected,
    hasSelection,
    selectedTotal,
    selectedAverage,
    clearSelection,
    toggleTransactionSelection,
    selectAllOnPage,
  } = useTransactionsSelection({
    transactions,
  })
  const total = isAmountFilterInvalid ? 0 : (transactionsQuery.data?.total ?? 0)
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const isTransactionsRefetching =
    transactionsQuery.isFetching && !transactionsQuery.isLoading
  useTransactionsFilters({
    search,
    navigate,
    page,
    limit,
    sortKey,
    sortDirection,
    totalPages,
    hasLoadedPageData: transactionsQuery.data !== undefined,
  })
  const dateFormatter = new Intl.DateTimeFormat('pt-BR')

  const handleDateFocus = (event: FocusEvent<HTMLInputElement>) => {
    if (!isMobile) {
      return
    }
    const input = event.currentTarget
    if (typeof input.showPicker === 'function') {
      input.showPicker()
    }
  }
  const paginationItems = buildPaginationItems(page, totalPages)
  const {
    handleLimitChange,
    goToPreviousPage,
    goToNextPage,
    goToPage,
  } = useTransactionsPagination({
    page,
    totalPages,
    navigate,
    setLimitPreference,
  })

  const accountMap = new Map(
    (accountsQuery.data ?? []).map((account) => [account.id, account.name]),
  )
  const categoryMap = new Map(
    categories.map((category) => [category.id, category.name]),
  )

  const resetCreateForm = useCallback(() => {
    isCreateFromDuplicate.current = false
    lastCreateCategoryId.current = null
    pendingCategorySelection.current = null
    pendingSubcategorySelection.current = null
    setIsCreateRecurrenceEnabled(false)
    resetCreateRecurrenceDraft()
    setIsCreateAccountSelectOpen(false)
    setCreateCategoryTreeSearch('')
    reset({
      accountId: primaryAccountId || '',
      categoryId: '',
      subcategoryId: '',
      type: '',
      amount: '',
      date: formatDateInput(new Date()),
      description: '',
      notes: '',
    })
    clearErrors()
  }, [
    clearErrors,
    isCreateFromDuplicate,
    lastCreateCategoryId,
    pendingCategorySelection,
    pendingSubcategorySelection,
    primaryAccountId,
    reset,
    resetCreateRecurrenceDraft,
    setCreateCategoryTreeSearch,
    setIsCreateAccountSelectOpen,
    setIsCreateRecurrenceEnabled,
  ])

  const handleClearCreateForm = useCallback(() => {
    resetCreateForm()
  }, [resetCreateForm])

  const handleCloseCreateModal = useCallback(() => {
    setIsCreateOpen(false)
    setIsCreateRecurrenceEnabled(false)
    resetCreateRecurrenceDraft()
    setIsCreateAccountSelectOpen(false)
    setIsCreateCategoryTreeOpen(false)
    setCreateCategoryTreeSearch('')
  }, [
    resetCreateRecurrenceDraft,
    setCreateCategoryTreeSearch,
    setIsCreateAccountSelectOpen,
    setIsCreateCategoryTreeOpen,
    setIsCreateOpen,
    setIsCreateRecurrenceEnabled,
  ])
  const createTransactionForm = useTransactionForm({
    mode: 'create',
    isCreateRecurrenceEnabled,
    recurrenceDraft,
    createTransaction: createTransactionMutation.mutateAsync,
    createRecurrence: createRecurrenceMutation.mutateAsync,
    deleteTransaction: deleteTransactionMutation.mutateAsync,
    selectedTransactionId: selectedTransaction?.id ?? null,
    updateTransaction: updateTransactionMutation.mutateAsync,
    onCreateSuccess: () => {
      resetCreateForm()
      setIsCreateOpen(false)
    },
    onEditSuccess: () => {
      setIsEditOpen(false)
      setSelectedTransaction(null)
    },
    setCreateRootError: (message) => {
      setError('root', { message })
    },
    setEditRootError: (message) => {
      setEditError('root', { message })
    },
  })
  const editTransactionForm = useTransactionForm({
    mode: 'edit',
    selectedTransactionId: selectedTransaction?.id ?? null,
    updateTransaction: updateTransactionMutation.mutateAsync,
    onEditSuccess: () => {
      setIsEditOpen(false)
      setSelectedTransaction(null)
    },
    setEditRootError: (message) => {
      setEditError('root', { message })
    },
  })

  const submitCreateTransaction = handleSubmit(createTransactionForm.onSubmit)
  const submitEditTransaction = handleEditSubmit(editTransactionForm.onSubmit)
  const { submitCreateCategory, submitCreateSubcategory } =
    useTransactionsInlineCategoryActions({
      createCategoryModalTarget,
      createSubcategoryModalTarget,
      createCategoryId,
      categoryCreateForm,
      subcategoryCreateForm,
      createCategory: createCategoryMutation.mutateAsync,
      createSubcategory: createSubcategoryMutation.mutateAsync,
      setIsCreateCategoryOpen,
      setIsCreateSubcategoryOpen,
      setLastCreatedSubcategory,
      pendingCategorySelection,
      pendingSubcategorySelection,
      lastCreateCategoryId,
      lastEditCategoryId,
      createCategorySelectRef,
      setCreateValue: setValue,
      setEditValue,
    })

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
      pendingCategorySelection.current = null
      pendingSubcategorySelection.current = null
      return
    }

    if (lastCreateCategoryId.current !== createCategoryId) {
      setValue('subcategoryId', '')
      lastCreateCategoryId.current = createCategoryId
    }

    if (createCategory?.type) {
      setValue('type', createCategory.type)
    }
  }, [
    createCategory?.type,
    createCategoryId,
    lastCreateCategoryId,
    pendingCategorySelection,
    pendingSubcategorySelection,
    setValue,
  ])

  useEffect(() => {
    const pending = pendingCategorySelection.current
    if (!pending) {
      return
    }
    if (!categories.some((category) => category.id === pending)) {
      return
    }
    setValue('categoryId', pending, { shouldDirty: true, shouldTouch: true })
    pendingCategorySelection.current = null
  }, [categories, pendingCategorySelection, setValue])

  useEffect(() => {
    const pending = pendingSubcategorySelection.current
    if (!pending || pending.categoryId !== createCategoryId) {
      return
    }
    if (
      !createSubcategories.some(
        (subcategory) => subcategory.id === pending.subcategoryId,
      )
    ) {
      return
    }
    setValue('subcategoryId', pending.subcategoryId, {
      shouldDirty: true,
      shouldTouch: true,
    })
    pendingSubcategorySelection.current = null
  }, [
    createCategoryId,
    createSubcategories,
    pendingSubcategorySelection,
    setValue,
  ])

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
  }, [editCategory?.type, editCategoryId, lastEditCategoryId, setEditValue])

  useEffect(() => {
    const hasOpenModal =
      isCreateOpen ||
      isCreateCategoryOpen ||
      isCreateSubcategoryOpen ||
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
    isCreateCategoryOpen,
    isCreateSubcategoryOpen,
    isTransferOpen,
    isEditOpen,
    isDeleteConfirmOpen,
    isBulkDeleteOpen,
    selectedTransaction,
  ])

  useEffect(() => {
    const hasOpenModal =
      isCreateOpen ||
      isCreateCategoryOpen ||
      isCreateSubcategoryOpen ||
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
        clearSelection()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [
    clearSelection,
    handleClearFilters,
    hasActiveFilters,
    isCreateCategoryOpen,
    isCreateOpen,
    isCreateSubcategoryOpen,
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
      clearErrors('root')
      if (
        !isCreateFromDuplicate.current &&
        primaryAccountId &&
        !createAccountId
      ) {
        setValue('accountId', primaryAccountId)
      }
      const isDuplicate = isCreateFromDuplicate.current
      if (isCreateFromDuplicate.current) {
        isCreateFromDuplicate.current = false
      }
      if (isDuplicate) {
        dateInputRef.current?.focus()
      } else {
        descriptionInputRef.current?.focus()
      }
    }
  }, [
    clearErrors,
    createAccountId,
    dateInputRef,
    descriptionInputRef,
    isCreateFromDuplicate,
    isCreateOpen,
    primaryAccountId,
    setValue,
  ])

  useEffect(() => {
    if (!isCreateCategoryOpen) {
      return
    }
    categoryCreateForm.reset({
      name: '',
      type: createType || '',
    })
    const focusId = window.setTimeout(() => {
      categoryTypeRef.current?.focus()
    }, 0)
    return () => window.clearTimeout(focusId)
  }, [categoryCreateForm, categoryTypeRef, createType, isCreateCategoryOpen])

  useEffect(() => {
    if (!isCreateSubcategoryOpen) {
      return
    }
    const fallbackCategoryId =
      (createSubcategoryModalTarget === 'edit'
        ? editCategoryId
        : createCategoryId) ||
      categories.find((category) => !category.system)?.id ||
      ''
    subcategoryCreateForm.reset({
      categoryId: fallbackCategoryId,
      name: '',
    })
    const focusId = window.setTimeout(() => {
      subcategoryNameRef.current?.focus()
    }, 0)
    return () => window.clearTimeout(focusId)
  }, [
    categories,
    createCategoryId,
    createSubcategoryModalTarget,
    editCategoryId,
    isCreateSubcategoryOpen,
    subcategoryNameRef,
    subcategoryCreateForm,
  ])

  useEffect(() => {
    if (!isTransferOpen) {
      return
    }

    transferAmountRef.current?.focus()
  }, [isTransferOpen, transferAmountRef])

  const focusCreateCategoryOption = useCallback((direction: 'up' | 'down') => {
    const content = createCategoryTreeContentRef.current
    if (!content) {
      return
    }

    const options = Array.from(
      content.querySelectorAll<HTMLElement>('[role="option"]'),
    ).filter(
      (option) =>
        option.offsetParent !== null &&
        option.getAttribute('aria-disabled') !== 'true' &&
        !option.hasAttribute('data-disabled'),
    )

    if (options.length === 0) {
      return
    }

    const selectedIndex = options.findIndex(
      (option) =>
        option.getAttribute('aria-selected') === 'true' ||
        option.getAttribute('data-state') === 'checked',
    )

    const nextIndex =
      selectedIndex === -1
        ? direction === 'down'
          ? 0
          : options.length - 1
        : direction === 'down'
          ? Math.min(selectedIndex + 1, options.length - 1)
          : Math.max(selectedIndex - 1, 0)

    options[nextIndex]?.focus({ preventScroll: true })
  }, [createCategoryTreeContentRef])

  const getCreateCategoryTreeValue = useCallback(() => {
    if (!createCategoryId) {
      return CREATE_CATEGORY_TREE_NONE
    }
    if (createSubcategoryId) {
      return `subcategory:${createCategoryId}:${createSubcategoryId}`
    }
    return `category:${createCategoryId}`
  }, [CREATE_CATEGORY_TREE_NONE, createCategoryId, createSubcategoryId])

  const handleCreateCategoryTreeOpenChange = useCallback((open: boolean) => {
    setIsCreateCategoryTreeOpen(open)
    if (!open) {
      setCreateCategoryTreeSearch('')
      return
    }
    window.requestAnimationFrame(() => {
      createCategoryTreeSearchInputRef.current?.focus()
    })
  }, [
    createCategoryTreeSearchInputRef,
    setCreateCategoryTreeSearch,
    setIsCreateCategoryTreeOpen,
  ])

  const handleCreateCategoryTreeSelectValueChange = useCallback(
    (
      value: string,
      onCategoryChange: ControllerRenderProps<
        TransactionCreateFormData,
        'categoryId'
      >['onChange'],
    ) => {
      if (value === CREATE_CATEGORY_TREE_CREATE_CATEGORY) {
        setCreateCategoryTreeSearch('')
        setCreateCategoryModalTarget('create')
        setIsCreateCategoryOpen(true)
        return
      }
      if (value === CREATE_CATEGORY_TREE_CREATE_SUBCATEGORY) {
        setCreateCategoryTreeSearch('')
        setCreateSubcategoryModalTarget('create')
        setIsCreateSubcategoryOpen(true)
        return
      }
      if (value === CREATE_CATEGORY_TREE_NONE) {
        setCreateCategoryTreeSearch('')
        onCategoryChange('')
        setValue('subcategoryId', '', {
          shouldDirty: true,
          shouldTouch: true,
        })
        return
      }

      setCreateCategoryTreeSearch('')
      if (value.startsWith('subcategory:')) {
        const [, categoryId, subcategoryId] = value.split(':')
        lastCreateCategoryId.current = categoryId ?? null
        onCategoryChange(categoryId ?? '')
        setValue('subcategoryId', subcategoryId ?? '', {
          shouldDirty: true,
          shouldTouch: true,
        })
        return
      }

      const [, categoryId] = value.split(':')
      onCategoryChange(categoryId ?? '')
      setValue('subcategoryId', '', {
        shouldDirty: true,
        shouldTouch: true,
      })
    },
    [
      CREATE_CATEGORY_TREE_CREATE_CATEGORY,
      CREATE_CATEGORY_TREE_CREATE_SUBCATEGORY,
      CREATE_CATEGORY_TREE_NONE,
      lastCreateCategoryId,
      setCreateCategoryModalTarget,
      setCreateCategoryTreeSearch,
      setCreateSubcategoryModalTarget,
      setIsCreateCategoryOpen,
      setIsCreateSubcategoryOpen,
      setValue,
    ],
  )

  const handleCreateCategoryTreeSearchKeyDown: KeyboardEventHandler<HTMLInputElement> =
    useCallback(
      (event) => {
        if (event.key === 'Tab') {
          event.preventDefault()
          event.stopPropagation()
          focusCreateCategoryOption(event.shiftKey ? 'up' : 'down')
          return
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          event.stopPropagation()
          focusCreateCategoryOption('down')
          return
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault()
          event.stopPropagation()
          focusCreateCategoryOption('up')
          return
        }
        if (event.key === 'Escape') {
          return
        }
        const isTypingKey =
          (event.key.length === 1 || event.key === 'Dead') &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey
        if (
          isTypingKey ||
          event.key === 'Backspace' ||
          event.key === 'Delete'
        ) {
          event.stopPropagation()
          event.nativeEvent.stopImmediatePropagation?.()
          return
        }
        event.stopPropagation()
      },
      [focusCreateCategoryOption],
    )

  const findVisibleSiblingOption = useCallback(
    (element: HTMLElement, direction: 'prev' | 'next'): HTMLElement | null => {
      let sibling: Element | null =
        direction === 'prev'
          ? element.previousElementSibling
          : element.nextElementSibling

      while (sibling) {
        if (
          sibling instanceof HTMLElement &&
          sibling.getAttribute('role') === 'option' &&
          sibling.offsetParent !== null &&
          sibling.getAttribute('aria-disabled') !== 'true' &&
          !sibling.hasAttribute('data-disabled')
        ) {
          return sibling
        }
        sibling =
          direction === 'prev'
            ? sibling.previousElementSibling
            : sibling.nextElementSibling
      }

      return null
    },
    [],
  )

  const handleCreateCategoryTreeItemKeyDown = useCallback(
    (event: Parameters<KeyboardEventHandler<HTMLDivElement>>[0]) => {
      if (event.key === 'Backspace') {
        event.preventDefault()
        event.stopPropagation()
        window.requestAnimationFrame(() => {
          createCategoryTreeSearchInputRef.current?.focus()
        })
        return
      }
      const current = event.currentTarget as HTMLElement
      if (event.key === 'ArrowDown') {
        const nextOption = findVisibleSiblingOption(current, 'next')
        if (nextOption) {
          return
        }
        event.preventDefault()
        event.stopPropagation()
        createCategoryTreeSearchInputRef.current?.focus()
        return
      }
      if (event.key !== 'ArrowUp') {
        return
      }
      const previousOption = findVisibleSiblingOption(current, 'prev')
      if (previousOption) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      createCategoryTreeSearchInputRef.current?.focus()
    },
    [createCategoryTreeSearchInputRef, findVisibleSiblingOption],
  )

  const focusEditCategoryOption = useCallback((direction: 'up' | 'down') => {
    const content = editCategoryTreeContentRef.current
    if (!content) {
      return
    }

    const options = Array.from(
      content.querySelectorAll<HTMLElement>('[role="option"]'),
    ).filter(
      (option) =>
        option.offsetParent !== null &&
        option.getAttribute('aria-disabled') !== 'true' &&
        !option.hasAttribute('data-disabled'),
    )

    if (options.length === 0) {
      return
    }

    const selectedIndex = options.findIndex(
      (option) =>
        option.getAttribute('aria-selected') === 'true' ||
        option.getAttribute('data-state') === 'checked',
    )

    const nextIndex =
      selectedIndex === -1
        ? direction === 'down'
          ? 0
          : options.length - 1
        : direction === 'down'
          ? Math.min(selectedIndex + 1, options.length - 1)
          : Math.max(selectedIndex - 1, 0)

    options[nextIndex]?.focus({ preventScroll: true })
  }, [editCategoryTreeContentRef])

  const getEditCategoryTreeValue = useCallback(() => {
    if (!editCategoryId) {
      return CREATE_CATEGORY_TREE_NONE
    }
    if (editSubcategoryId) {
      return `subcategory:${editCategoryId}:${editSubcategoryId}`
    }
    return `category:${editCategoryId}`
  }, [CREATE_CATEGORY_TREE_NONE, editCategoryId, editSubcategoryId])

  const handleEditCategoryTreeOpenChange = useCallback((open: boolean) => {
    setIsEditCategoryTreeOpen(open)
    if (!open) {
      setEditCategoryTreeSearch('')
      return
    }
    window.requestAnimationFrame(() => {
      editCategoryTreeSearchInputRef.current?.focus()
    })
  }, [
    editCategoryTreeSearchInputRef,
    setEditCategoryTreeSearch,
    setIsEditCategoryTreeOpen,
  ])

  const handleEditCategoryTreeValueChange = useCallback(
    (
      value: string,
      onCategoryChange: ControllerRenderProps<
        TransactionCreateFormData,
        'categoryId'
      >['onChange'],
    ) => {
      if (value === CREATE_CATEGORY_TREE_CREATE_CATEGORY) {
        setEditCategoryTreeSearch('')
        setCreateCategoryModalTarget('edit')
        setIsCreateCategoryOpen(true)
        return
      }
      if (value === CREATE_CATEGORY_TREE_CREATE_SUBCATEGORY) {
        setEditCategoryTreeSearch('')
        setCreateSubcategoryModalTarget('edit')
        setIsCreateSubcategoryOpen(true)
        return
      }
      if (value === CREATE_CATEGORY_TREE_NONE) {
        setEditCategoryTreeSearch('')
        onCategoryChange('')
        setEditValue('subcategoryId', '', {
          shouldDirty: true,
          shouldTouch: true,
        })
        return
      }

      setEditCategoryTreeSearch('')
      if (value.startsWith('subcategory:')) {
        const [, categoryId, subcategoryId] = value.split(':')
        lastEditCategoryId.current = categoryId ?? null
        onCategoryChange(categoryId ?? '')
        setEditValue('subcategoryId', subcategoryId ?? '', {
          shouldDirty: true,
          shouldTouch: true,
        })
        return
      }

      const [, categoryId] = value.split(':')
      onCategoryChange(categoryId ?? '')
      setEditValue('subcategoryId', '', {
        shouldDirty: true,
        shouldTouch: true,
      })
    },
    [
      CREATE_CATEGORY_TREE_CREATE_CATEGORY,
      CREATE_CATEGORY_TREE_CREATE_SUBCATEGORY,
      CREATE_CATEGORY_TREE_NONE,
      lastEditCategoryId,
      setCreateCategoryModalTarget,
      setCreateSubcategoryModalTarget,
      setEditCategoryTreeSearch,
      setIsCreateCategoryOpen,
      setIsCreateSubcategoryOpen,
      setEditValue,
    ],
  )

  const handleEditCategoryTreeSearchKeyDown: KeyboardEventHandler<HTMLInputElement> =
    useCallback(
      (event) => {
        if (event.key === 'Tab') {
          event.preventDefault()
          event.stopPropagation()
          focusEditCategoryOption(event.shiftKey ? 'up' : 'down')
          return
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          event.stopPropagation()
          focusEditCategoryOption('down')
          return
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault()
          event.stopPropagation()
          focusEditCategoryOption('up')
          return
        }
        if (event.key === 'Escape') {
          return
        }
        const isTypingKey =
          (event.key.length === 1 || event.key === 'Dead') &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey
        if (
          isTypingKey ||
          event.key === 'Backspace' ||
          event.key === 'Delete'
        ) {
          event.stopPropagation()
          event.nativeEvent.stopImmediatePropagation?.()
          return
        }
        event.stopPropagation()
      },
      [focusEditCategoryOption],
    )

  const handleEditCategoryTreeItemKeyDown = useCallback(
    (event: Parameters<KeyboardEventHandler<HTMLDivElement>>[0]) => {
      if (event.key === 'Backspace') {
        event.preventDefault()
        event.stopPropagation()
        window.requestAnimationFrame(() => {
          editCategoryTreeSearchInputRef.current?.focus()
        })
        return
      }

      const current = event.currentTarget as HTMLElement
      if (event.key === 'ArrowDown') {
        const nextOption = findVisibleSiblingOption(current, 'next')
        if (nextOption) {
          return
        }
        event.preventDefault()
        event.stopPropagation()
        editCategoryTreeSearchInputRef.current?.focus()
        return
      }
      if (event.key !== 'ArrowUp') {
        return
      }
      const previousOption = findVisibleSiblingOption(current, 'prev')
      if (previousOption) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      editCategoryTreeSearchInputRef.current?.focus()
    },
    [editCategoryTreeSearchInputRef, findVisibleSiblingOption],
  )

  useEffect(() => {
    if (isEditOpen) {
      const editDescriptionInput = document.getElementById(
        'transaction-edit-description',
      ) as HTMLInputElement | null
      editDescriptionInput?.focus()
      return
    }
    setIsCreateAccountSelectOpen(false)
    setIsEditAccountSelectOpen(false)
    setIsTransferFromAccountSelectOpen(false)
    setIsEditCategoryTreeOpen(false)
    setEditCategoryTreeSearch('')
  }, [
    isEditOpen,
    setEditCategoryTreeSearch,
    setIsCreateAccountSelectOpen,
    setIsEditAccountSelectOpen,
    setIsEditCategoryTreeOpen,
    setIsTransferFromAccountSelectOpen,
  ])

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
          Digit3: 'transaction-edit-category',
          Digit4: 'transaction-edit-date',
          Digit5: 'transaction-edit-amount',
          Digit6: 'transaction-edit-description',
          Digit7: 'transaction-edit-notes',
          Numpad1: 'transaction-edit-account',
          Numpad2: 'transaction-edit-category',
          Numpad3: 'transaction-edit-category',
          Numpad4: 'transaction-edit-date',
          Numpad5: 'transaction-edit-amount',
          Numpad6: 'transaction-edit-description',
          Numpad7: 'transaction-edit-notes',
        }
      : {
          Digit1: 'transaction-account',
          Digit2: 'transaction-category',
          Digit3: 'transaction-category',
          Digit4: 'transaction-date',
          Digit5: 'transaction-amount',
          Digit6: 'transaction-description',
          Digit7: 'transaction-notes',
          Numpad1: 'transaction-account',
          Numpad2: 'transaction-category',
          Numpad3: 'transaction-category',
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
        event.code === 'Digit1' ||
        event.code === 'Digit2' ||
        event.code === 'Digit3' ||
        event.code === 'Digit4' ||
        event.code === 'Digit5' ||
        event.code === 'Digit6' ||
        event.code === 'Digit7' ||
        event.code === 'Numpad1' ||
        event.code === 'Numpad2' ||
        event.code === 'Numpad3' ||
        event.code === 'Numpad4' ||
        event.code === 'Numpad5' ||
        event.code === 'Numpad6' ||
        event.code === 'Numpad7'
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
    if (!isCreateOpen || isCreateCategoryOpen || isCreateSubcategoryOpen) {
      return
    }

    const handleCreateActionShortcut = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey) {
        if (event.shiftKey && event.key.toLowerCase() === 'l') {
          event.preventDefault()
          handleClearCreateForm()
          return
        }
        if (event.key === 'Enter') {
          event.preventDefault()
          void submitCreateTransaction()
        }
        return
      }
    }

    window.addEventListener('keydown', handleCreateActionShortcut, true)
    return () => {
      window.removeEventListener('keydown', handleCreateActionShortcut, true)
    }
  }, [
    handleClearCreateForm,
    handleCloseCreateModal,
    isCreateCategoryOpen,
    isCreateOpen,
    isCreateSubcategoryOpen,
    submitCreateTransaction,
  ])


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
      if (isCreateSubcategoryOpen) {
        setIsCreateSubcategoryOpen(false)
        return
      }
      if (isCreateCategoryOpen) {
        setIsCreateCategoryOpen(false)
        return
      }

      if (isTransferOpen) {
        if (isTransferToAccountSelectOpen) {
          setIsTransferToAccountSelectOpen(false)
          return
        }
        if (isTransferFromAccountSelectOpen) {
          setIsTransferFromAccountSelectOpen(false)
          return
        }
        setIsTransferOpen(false)
        return
      }

      if (isEditOpen) {
        if (isEditCategoryTreeOpen) {
          setIsEditCategoryTreeOpen(false)
          return
        }
        if (isEditAccountSelectOpen) {
          setIsEditAccountSelectOpen(false)
          return
        }
        setIsEditOpen(false)
        return
      }

      if (isCreateOpen) {
        if (isDescriptionSuggestionsOpen) {
          setIsDescriptionSuggestionsOpen(false)
          return
        }
        if (isCreateAccountSelectOpen) {
          setIsCreateAccountSelectOpen(false)
          return
        }
        if (isCreateCategoryTreeOpen) {
          setIsCreateCategoryTreeOpen(false)
          return
        }
        handleCloseCreateModal()
        return
      }

      if (selectedTransaction) {
        setSelectedTransaction(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    handleCloseCreateModal,
    isCreateOpen,
    isCreateCategoryTreeOpen,
    isDescriptionSuggestionsOpen,
    isCreateAccountSelectOpen,
    isCreateCategoryOpen,
    isCreateSubcategoryOpen,
    isTransferOpen,
    isTransferFromAccountSelectOpen,
    isTransferToAccountSelectOpen,
    isEditOpen,
    setIsBulkDeleteOpen,
    setIsCreateAccountSelectOpen,
    setIsCreateCategoryOpen,
    setIsCreateCategoryTreeOpen,
    setIsCreateSubcategoryOpen,
    setIsDeleteConfirmOpen,
    setIsDescriptionSuggestionsOpen,
    setIsEditAccountSelectOpen,
    setIsEditCategoryTreeOpen,
    setIsEditOpen,
    setIsTransferFromAccountSelectOpen,
    setIsTransferOpen,
    setIsTransferToAccountSelectOpen,
    setSelectedTransaction,
    isEditAccountSelectOpen,
    isEditCategoryTreeOpen,
    isDeleteConfirmOpen,
    isBulkDeleteOpen,
    selectedTransaction,
  ])

  const openTransferCreate = useCallback(() => {
    setTransferRequest({ mode: 'create' })
    setIsTransferOpen(true)
  }, [setIsTransferOpen])

  const handleOpenRepeatTransfer = useCallback((transaction: Transaction) => {
    setTransferRequest({ mode: 'repeat', transaction })
    setSelectedTransaction(null)
    setIsTransferOpen(true)
  }, [setIsTransferOpen, setSelectedTransaction])

  const handleOpenEditTransfer = useCallback((transaction: Transaction) => {
    setTransferRequest({ mode: 'edit', transaction })
    setSelectedTransaction(null)
    setIsTransferOpen(true)
  }, [setIsTransferOpen, setSelectedTransaction])

  const openTransactionCreate = useCallback(() => {
    setCreateDraftTransaction(null)
    isCreateFromDuplicate.current = false
    setIsCreateRecurrenceEnabled(false)
    resetCreateRecurrenceDraft()
    setIsCreateOpen(true)
  }, [
    isCreateFromDuplicate,
    resetCreateRecurrenceDraft,
    setCreateDraftTransaction,
    setIsCreateOpen,
    setIsCreateRecurrenceEnabled,
  ])

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const hasOpenModal =
        isCreateOpen ||
        isTransferOpen ||
        isEditOpen ||
        isDeleteConfirmOpen ||
        isBulkDeleteOpen ||
        !!selectedTransaction
      if (hasOpenModal) {
        return
      }
      if (event.metaKey || event.ctrlKey) {
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
      const key = event.key?.toLowerCase()
      const keyCode = (event as KeyboardEvent & { keyCode?: number }).keyCode

      if (key === 'n' || event.code === 'KeyN' || keyCode === 78) {
        event.preventDefault()
        openTransactionCreate()
      }

      if (key === 't' || event.code === 'KeyT' || keyCode === 84) {
        event.preventDefault()
        openTransferCreate()
      }
    }

    window.addEventListener('keydown', handleShortcut, true)
    return () => {
      window.removeEventListener('keydown', handleShortcut, true)
    }
  }, [
    isBulkDeleteOpen,
    isCreateOpen,
    isDeleteConfirmOpen,
    isEditOpen,
    isTransferOpen,
    openTransactionCreate,
    openTransferCreate,
    selectedTransaction,
  ])

  const handleCopyValue = async (value: number, label: 'average' | 'total') => {
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
    }
  }, [copyTimeoutRef])

  useEffect(() => {
    if (!selectAllRef.current) {
      return
    }
    selectAllRef.current.indeterminate = hasSelection && !allSelected
  }, [allSelected, hasSelection, selectAllRef])

  const handleOpenEdit = useCallback(
    (transaction: Transaction) => {
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
    },
    [lastEditCategoryId, resetEdit, setIsEditOpen, setSelectedTransaction],
  )

  const handleOpenDuplicate = useCallback(
    (transaction: Transaction) => {
      if (transaction.transferId) {
        return
      }
      setCreateDraftTransaction(transaction)
      setSelectedTransaction(null)
      setIsCreateOpen(true)
    },
    [
      setCreateDraftTransaction,
      setIsCreateOpen,
      setSelectedTransaction,
    ],
  )

  const handleOpenDelete = useCallback((transaction: Transaction) => {
    setSelectedTransaction(transaction)
    setIsDeleteConfirmOpen(true)
  }, [setIsDeleteConfirmOpen, setSelectedTransaction])

  useEffect(() => {
    if (!selectedTransaction || isEditOpen || isDeleteConfirmOpen) {
      return
    }

    const handleDetailShortcut = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) {
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

      const key = event.key.toLowerCase()

      if (key === 'd' && !selectedTransaction.transferId) {
        event.preventDefault()
        handleOpenDuplicate(selectedTransaction)
        return
      }

      if (key === 'e') {
        event.preventDefault()
        if (selectedTransaction.transferId) {
          void handleOpenEditTransfer(selectedTransaction)
        } else {
          handleOpenEdit(selectedTransaction)
        }
        return
      }

      if (key === 'r') {
        event.preventDefault()
        handleOpenDelete(selectedTransaction)
      }
    }

    window.addEventListener('keydown', handleDetailShortcut, true)
    return () => {
      window.removeEventListener('keydown', handleDetailShortcut, true)
    }
  }, [
    handleOpenDuplicate,
    handleOpenEdit,
    handleOpenEditTransfer,
    isDeleteConfirmOpen,
    isEditOpen,
    handleOpenDelete,
    selectedTransaction,
  ])

  return (
    <div className="flex h-full min-h-0 flex-col gap-6">
      <TransactionsToolbar
        isFiltersOpen={isFiltersOpen}
        hasActiveFilters={Boolean(hasActiveFilters)}
        isCreateMenuOpen={isCreateMenuOpen}
        setIsFiltersOpen={setIsFiltersOpen}
        setIsCreateMenuOpen={setIsCreateMenuOpen}
        onOpenTransactionCreate={openTransactionCreate}
        onOpenTransferCreate={openTransferCreate}
      />

      <div
        className={`rounded-lg border bg-card p-3 ${
          isFiltersOpen ? 'block' : 'hidden'
        } desktop-force-block`}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <h3 className="text-sm font-semibold">Filtros</h3>
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              id="filter-description"
              placeholder={
                amountMode
                  ? 'Buscar por valor (ex: 123,45 | >100 | 100;200 | =100+20)'
                  : 'Buscar por descrição'
              }
              value={amountMode ? amountDraft : descriptionDraft}
              className="bg-background dark:bg-muted/50"
              onChange={(event) => {
                const nextValue = event.target.value
                if (amountMode) {
                  setAmountDraft(nextValue)
                } else {
                  setDescriptionDraft(nextValue)
                }
              }}
            />
            <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto sm:flex-nowrap">
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
                    amountMode
                      ? 'Desative a busca por valor para usar notas'
                      : canSearchNotes
                        ? undefined
                        : 'Informe uma descrição para buscar nas notas'
                  }
                >
                  <input
                    id="filter-include-notes"
                    type="checkbox"
                    className="h-5 w-5 sm:h-4 sm:w-4"
                    checked={includeNotes}
                    disabled={!canSearchNotes || amountMode}
                    onChange={(event) => setIncludeNotesFilter(event.target.checked)}
                  />
                  Buscar nas notas
                </label>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    id="filter-notes-only"
                    type="checkbox"
                    className="h-5 w-5 sm:h-4 sm:w-4"
                    checked={notesOnly}
                    disabled={!canSearchNotes || amountMode}
                    onChange={(event) => setNotesOnlyFilter(event.target.checked)}
                  />
                  Somente notas
                </label>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    id="filter-amount-mode"
                    type="checkbox"
                    className="h-5 w-5 sm:h-4 sm:w-4"
                    checked={amountMode}
                    onChange={(event) => setAmountModeFilter(event.target.checked)}
                  />
                  Buscar por valor
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
                inputMode={isMobile ? 'none' : undefined}
                onChange={(event) => setStartDateFilter(event.target.value)}
                onClick={handleDateClick}
                onKeyDown={handleMobileDateKeyDown}
                onPaste={handleMobileDatePaste}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-end-date">Data final</Label>
              <Input
                id="filter-end-date"
                type="date"
                value={endDateFilter}
                className="bg-background dark:bg-muted/50"
                inputMode={isMobile ? 'none' : undefined}
                onChange={(event) => setEndDateFilter(event.target.value)}
                onClick={handleDateClick}
                onKeyDown={handleMobileDateKeyDown}
                onPaste={handleMobileDatePaste}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-type">Tipo</Label>
              <Select
                value={typeFilter ?? 'all'}
                onValueChange={setTypeFilterValue}
              >
                <SelectTrigger
                  id="filter-type"
                  className="h-10 bg-background dark:bg-muted/50"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="income">Receita</SelectItem>
                  <SelectItem value="expense">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-account">Conta</Label>
              <Select
                value={accountFilter ?? 'all'}
                onValueChange={setAccountFilterValue}
              >
                <SelectTrigger
                  id="filter-account"
                  className="h-10 bg-background dark:bg-muted/50"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {(accountsQuery.data ?? []).map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-category">Categoria</Label>
              <Select
                value={categoryFilter ?? 'all'}
                onValueChange={setCategoryFilterValue}
              >
                <SelectTrigger
                  id="filter-category"
                  className="h-10 bg-background dark:bg-muted/50"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {availableCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-subcategory">Subcategoria</Label>
              <Select
                value={subcategoryFilter ?? 'all'}
                onValueChange={setSubcategoryFilterValue}
                disabled={!categoryFilter}
              >
                <SelectTrigger
                  id="filter-subcategory"
                  className="h-10 bg-background dark:bg-muted/50"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {(filterSubcategoriesQuery.data ?? []).map((subcategory) => (
                    <SelectItem key={subcategory.id} value={subcategory.id}>
                      {subcategory.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3 mobile-only">
        <div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-5 w-5 cursor-pointer"
                checked={allSelected}
                onChange={(event) => {
                  if (event.target.checked) {
                    selectAllOnPage()
                    return
                  }
                  clearSelection()
                }}
                aria-label="Selecionar todas as transações"
              />
              <span className="text-muted-foreground">
                {selectedIds.size > 0 ? 'Limpar seleção' : 'Selecionar tudo'}
              </span>
            </div>
            {selectedIds.size > 0 ? (
              <span className="font-semibold text-muted-foreground">
                {selectedIds.size}
              </span>
            ) : null}
          </div>
          {selectedCount >= 2 && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Média:</span>
                  <span className="relative">
                    <span
                      className={`sensitive cursor-pointer font-semibold ${getTransactionAmountToneClass(
                        selectedAverage,
                      )}`}
                      role="button"
                      tabIndex={0}
                      title="Clique para copiar"
                      onClick={() =>
                        handleCopyValue(selectedAverage, 'average')
                      }
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
                      <span className="absolute -top-6 right-0 rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground shadow-sm">
                        Copiado!
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Soma:</span>
                  <span className="relative">
                    <span
                      className={`sensitive cursor-pointer font-semibold ${getTransactionAmountToneClass(
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
                      <span className="absolute -top-6 right-0 rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground shadow-sm">
                        Copiado!
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {transactionsQuery.isLoading && (
          <div className="rounded-lg border px-4 py-6 text-center text-sm text-muted-foreground">
            Carregando transações...
          </div>
        )}
        {!transactionsQuery.isLoading && isAmountFilterInvalid && (
          <div className="rounded-lg border px-4 py-6 text-center text-sm text-muted-foreground">
            {amountFilterErrorMessage}
          </div>
        )}
        {!transactionsQuery.isLoading &&
          !isAmountFilterInvalid &&
          transactions.length === 0 && (
            <div className="rounded-lg border px-4 py-6 text-center text-sm text-muted-foreground">
              Nenhuma transação encontrada.
            </div>
          )}
        {transactions.map((transaction) => {
          const description =
            transaction.description ||
            transaction.categoryName ||
            categoryMap.get(transaction.categoryId) ||
            'Sem descrição'
          const amountClass =
            transaction.type === 'income'
              ? 'text-emerald-600'
              : transaction.type === 'expense'
                ? 'text-rose-600'
                : 'text-muted-foreground'
          return (
            <div
              key={transaction.id}
              className="cursor-pointer rounded-lg border bg-background p-3 transition hover:bg-muted/30"
              onClick={() => {
                clearTransferFeedback()
                setSelectedTransaction(transaction)
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{description}</span>
                </div>
                <input
                  id={`transaction-select-mobile-${transaction.id}`}
                  type="checkbox"
                  className="h-5 w-5 cursor-pointer"
                  checked={selectedIds.has(transaction.id)}
                  onClick={(event) => event.stopPropagation()}
                  onChange={() => toggleTransactionSelection(transaction.id)}
                  aria-label="Selecionar transação"
                />
              </div>
              <div className="mt-2 grid gap-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs uppercase text-muted-foreground">
                    Data
                  </span>
                  <span>
                    {formatDateDisplay(transaction.date, dateFormatter)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs uppercase text-muted-foreground">
                    Conta
                  </span>
                  <span>
                    {transaction.accountName ||
                      accountMap.get(transaction.accountId) ||
                      '-'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs uppercase text-muted-foreground">
                    Categoria
                  </span>
                  <span>
                    {transaction.categoryName ||
                      categoryMap.get(transaction.categoryId) ||
                      '-'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs uppercase text-muted-foreground">
                    Subcategoria
                  </span>
                  <span>
                    {transaction.subcategoryId
                      ? transaction.subcategoryName || '-'
                      : '-'}
                  </span>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={
                      transaction.type === 'income'
                        ? 'rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700'
                        : 'rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700'
                    }
                  >
                    {transaction.type === 'income' ? 'Receita' : 'Despesa'}
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
                <div className="flex items-center gap-2">
                  <span
                    className={`sensitive text-base font-semibold ${amountClass}`}
                  >
                    {formatCurrencyValue(transaction.amount)}
                  </span>
                </div>
              </div>
            </div>
          )
        })}

        {selectedCount >= 2 && (
          <Button
            variant="destructive"
            className="h-11 w-full"
            onClick={() => {
              setIsBulkDeleteOpen(true)
            }}
            disabled={isBulkDeleteOpen}
          >
            Excluir
          </Button>
        )}
      </div>

      {selectedCount >= 2 && (
        <div className="desktop-only rounded-lg border bg-card px-4 py-2 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setIsBulkDeleteOpen(true)
                }}
                disabled={isBulkDeleteOpen}
              >
                Excluir
              </Button>
              <span className="text-muted-foreground">
                {selectedCount} selecionadas
              </span>
            </div>
            <div className="flex w-full items-center justify-between gap-4 text-left sm:w-auto sm:justify-end sm:gap-5 sm:text-right">
              <div>
                Média:{' '}
                <span className="relative">
                  <span
                    className={`sensitive cursor-pointer font-semibold ${getTransactionAmountToneClass(
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
                    <span className="absolute -top-6 right-0 rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground shadow-sm">
                      Copiado!
                    </span>
                  )}
                </span>
              </div>
              <div>
                Soma:{' '}
                <span className="relative">
                  <span
                    className={`sensitive cursor-pointer font-semibold ${getTransactionAmountToneClass(
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
                    <span className="absolute -top-6 right-0 rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground shadow-sm">
                      Copiado!
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {!transactionsQuery.isLoading && totalPages > 1 && (
        <div className="mt-3 flex flex-col gap-2 rounded-lg border bg-card px-3 py-3 text-xs mobile-only">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">
              {isTransactionsRefetching
                ? `Carregando página ${page}...`
                : `Página ${page} de ${totalPages}`}
            </span>
            <Select
              value={String(limit)}
              disabled={isTransactionsRefetching}
              onValueChange={handleLimitChange}
            >
              <SelectTrigger
                className="h-9 w-[84px] bg-background px-2 text-xs dark:border-muted/80"
                aria-label="Quantidade de linhas"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 30, 50].map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="h-11 flex-1"
              disabled={page === 1 || isTransactionsRefetching}
              onClick={goToPreviousPage}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              className="h-11 flex-1"
              disabled={page === totalPages || isTransactionsRefetching}
              onClick={goToNextPage}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}

      <div className="desktop-only min-h-0 flex-1">
        <div className="flex h-full min-h-[520px] flex-col overflow-hidden rounded-lg border">
          <div className="min-h-0 flex-1 overflow-x-auto">
          <TransactionsTableDesktop
            transactions={transactions}
            isLoading={transactionsQuery.isLoading}
            isAmountFilterInvalid={isAmountFilterInvalid}
            amountFilterErrorMessage={amountFilterErrorMessage}
            selectedIds={selectedIds}
            allSelected={allSelected}
            sortKey={sortKey}
            sortDirection={sortDirection}
            selectAllRef={selectAllRef}
            accountMap={accountMap}
            categoryMap={categoryMap}
            dateFormatter={dateFormatter}
            onSort={handleSort}
            onSelectAllChange={(checked) => {
              if (checked) {
                selectAllOnPage()
                return
              }
              clearSelection()
            }}
            onToggleTransactionSelection={toggleTransactionSelection}
            onRowClick={(transaction) => {
              clearTransferFeedback()
              setSelectedTransaction(transaction)
            }}
            renderSortIcon={({
              isActive,
              direction,
            }: {
              isActive: boolean
              direction: 'asc' | 'desc'
            }) => (
              <TransactionsSortIcon isActive={isActive} direction={direction} />
            )}
            formatDateDisplay={formatDateDisplay}
            formatCurrencyValue={formatCurrencyValue}
          />
          </div>
          <div className="flex items-center justify-between border-t bg-card px-4 py-2 text-xs">
            <span className="text-muted-foreground">
              {isTransactionsRefetching
                ? `Carregando página ${page}...`
                : `Página ${page} de ${totalPages}`}
            </span>
            <div className="flex items-center gap-3">
              <Select
                value={String(limit)}
                disabled={isTransactionsRefetching}
                onValueChange={handleLimitChange}
              >
                <SelectTrigger
                  className="h-8 w-[72px] bg-background px-2 text-xs dark:border-muted/80"
                  aria-label="Quantidade de linhas"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 20, 30, 50].map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1 || isTransactionsRefetching}
                  onClick={goToPreviousPage}
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
                      disabled={isTransactionsRefetching}
                      onClick={() => goToPage(item)}
                    >
                      {item}
                    </Button>
                  ),
                )}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === totalPages || isTransactionsRefetching}
                  onClick={goToNextPage}
                  aria-label="Próxima página"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <TransactionsCreateModal
        isOpen={isCreateOpen}
        onClose={handleCloseCreateModal}
        onSuccess={() => {
          setCreateDraftTransaction(null)
          setIsCreateOpen(false)
        }}
        accounts={accountsQuery.data ?? []}
        categories={categories}
        availableCategories={availableCategories}
        primaryAccountId={primaryAccountId}
        draftTransaction={createDraftTransaction}
        onDraftHandled={() => setCreateDraftTransaction(null)}
      />


      <TransactionsInlineCategoryFlow
        isCreateCategoryOpen={isCreateCategoryOpen}
        isCreateSubcategoryOpen={isCreateSubcategoryOpen}
        availableCategories={availableCategories}
        categoryCreateForm={categoryCreateForm}
        subcategoryCreateForm={subcategoryCreateForm}
        categoryTypeRef={categoryTypeRef}
        categoryNameRef={categoryNameRef}
        subcategoryNameRef={subcategoryNameRef}
        isCreateCategorySubmitting={createCategoryMutation.isPending}
        isCreateSubcategorySubmitting={createSubcategoryMutation.isPending}
        onCloseCreateCategory={() => setIsCreateCategoryOpen(false)}
        onCloseCreateSubcategory={() => setIsCreateSubcategoryOpen(false)}
        onSubmitCreateCategory={submitCreateCategory}
        onSubmitCreateSubcategory={submitCreateSubcategory}
      />

      <TransactionsTransferModal
        isOpen={isTransferOpen}
        onClose={() => {
          setTransferRequest(null)
          legacyHandleCloseTransferModal()
        }}
        onRequestHandled={() => setTransferRequest(null)}
        accounts={accountsQuery.data ?? []}
        primaryAccountId={primaryAccountId}
        defaultTransferToAccountId={defaultTransferToAccountId}
        transactions={transactions}
        request={transferRequest}
      />

      <TransactionsDetailsModal
        selectedTransaction={!isEditOpen ? selectedTransaction : null}
        categoryMap={categoryMap}
        accountMap={accountMap}
        repeatTransferError={repeatTransferError}
        transferEditError={transferEditError}
        isRepeatTransferLoading={isRepeatTransferLoading}
        isEditTransferLoading={isEditTransferLoading}
        onClose={() => setSelectedTransaction(null)}
        onOpenRepeatTransfer={(transaction) => {
          setTransferRequest({ mode: 'repeat', transaction })
          setSelectedTransaction(null)
          setIsTransferOpen(true)
        }}
        onOpenDuplicate={handleOpenDuplicate}
        onOpenEdit={handleOpenEdit}
        onOpenEditTransfer={(transaction) => {
          setTransferRequest({ mode: 'edit', transaction })
          setSelectedTransaction(null)
          setIsTransferOpen(true)
        }}
        onOpenDelete={handleOpenDelete}
      />

      <TransactionsEditModal
        key={selectedTransaction?.id ?? 'edit-empty'}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSuccess={() => {
          setIsEditOpen(false)
          setSelectedTransaction(null)
        }}
        transaction={selectedTransaction}
        accounts={accountsQuery.data ?? []}
        categories={categories}
        availableCategories={availableCategories}
      />

      <TransactionsDeleteConfirmModal
        open={isDeleteConfirmOpen}
        transaction={selectedTransaction}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onDeleted={() => setSelectedTransaction(null)}
      />

      <TransactionsBulkDeleteModal
        open={isBulkDeleteOpen}
        selectedTransactions={selectedTransactions}
        onClose={() => setIsBulkDeleteOpen(false)}
        onDeleted={clearSelection}
      />
    </div>
  )
}
