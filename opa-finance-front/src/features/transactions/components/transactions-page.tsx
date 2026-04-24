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
  type FocusEvent,
  type KeyboardEventHandler,
} from 'react'
import {
  Controller,
  type ControllerRenderProps,
  useForm,
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
import { ShortcutTooltip } from '@/components/ui/shortcut-hint'
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
  const createType = watch('type')
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
    clearTransferFeedback,
    openTransferCreate,
    handleCloseTransferModal,
    submitTransferForm,
    handleSwapTransferAccounts,
    handleOpenRepeatTransfer,
    handleOpenEditTransfer,
  } = useTransferForm({
    isTransferOpen,
    primaryAccountId,
    defaultTransferToAccountId,
    transactions,
    createTransfer: createTransferMutation.mutateAsync,
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
  const {
    handleTransactionAmountChange,
    handleCreateAmountBlur,
    onCreateSubmit,
    onEditSubmit,
  } = useTransactionForm({
    isCreateRecurrenceEnabled,
    recurrenceDraft,
    selectedTransactionId: selectedTransaction?.id ?? null,
    createTransaction: createTransactionMutation.mutateAsync,
    createRecurrence: createRecurrenceMutation.mutateAsync,
    deleteTransaction: deleteTransactionMutation.mutateAsync,
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
    setCreateAmountError: (message) => {
      setError('amount', { type: 'manual', message })
    },
    clearCreateAmountError: () => {
      clearErrors('amount')
    },
  })
  const submitCreateTransaction = handleSubmit(onCreateSubmit)
  const submitEditTransaction = handleEditSubmit(onEditSubmit)
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

  const openTransactionCreate = useCallback(() => {
    isCreateFromDuplicate.current = false
    setIsCreateRecurrenceEnabled(false)
    resetCreateRecurrenceDraft()
    setIsCreateOpen(true)
  }, [
    isCreateFromDuplicate,
    resetCreateRecurrenceDraft,
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
      isCreateFromDuplicate.current = true
      lastCreateCategoryId.current = transaction.categoryId
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
      setIsCreateRecurrenceEnabled(false)
      resetCreateRecurrenceDraft(formatDateInput(new Date()))
      setSelectedTransaction(null)
      setIsCreateOpen(true)
    },
    [
      isCreateFromDuplicate,
      lastCreateCategoryId,
      reset,
      resetCreateRecurrenceDraft,
      setIsCreateOpen,
      setIsCreateRecurrenceEnabled,
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
      >
            <form
              className="mt-6 space-y-4 pb-10 sm:pb-0"
              onSubmit={submitCreateTransaction}
            >
              <div
                className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-2'}`}
              >
                <div className="space-y-2">
                  <Label htmlFor="transaction-account">Conta</Label>
                  <Controller
                    control={control}
                    name="accountId"
                    render={({ field }) => (
                      <Select
                        open={isCreateAccountSelectOpen}
                        value={field.value ? field.value : '__none__'}
                        onValueChange={(value) =>
                          field.onChange(value === '__none__' ? '' : value)
                        }
                        onOpenChange={setIsCreateAccountSelectOpen}
                      >
                        <SelectTrigger
                          id="transaction-account"
                          className="h-10"
                          aria-invalid={!!errors.accountId}
                          tabIndex={7}
                        >
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent
                          onEscapeKeyDown={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            setIsCreateAccountSelectOpen(false)
                          }}
                        >
                          <SelectItem value="__none__" className="hidden">
                            Selecione
                          </SelectItem>
                          {(accountsQuery.data ?? []).map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.accountId && (
                    <p className="text-sm text-destructive">
                      {errors.accountId.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="transaction-date">Data</Label>
                  {(() => {
                    const dateRegister = register('date')
                    return (
                      <Input
                        id="transaction-date"
                        type="date"
                        className="h-10"
                        aria-invalid={!!errors.date}
                        onFocus={handleDateFocus}
                        inputMode={isMobile ? 'none' : undefined}
                        tabIndex={6}
                        {...dateRegister}
                        ref={(element) => {
                          dateRegister.ref(element)
                          dateInputRef.current = element
                        }}
                        onClick={handleDateClick}
                        onKeyDown={handleMobileDateKeyDown}
                        onPaste={handleMobileDatePaste}
                      />
                    )
                  })()}
                  {errors.date && (
                    <p className="text-sm text-destructive">
                      {errors.date.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="transaction-category">
                    Categoria/Subcategoria
                  </Label>
                  <Controller
                    control={control}
                    name="categoryId"
                    render={({ field }) => (
                      <Select
                        open={isCreateCategoryTreeOpen}
                        value={getCreateCategoryTreeValue()}
                        onValueChange={(value) =>
                          handleCreateCategoryTreeSelectValueChange(
                            value,
                            field.onChange,
                          )
                        }
                        onOpenChange={handleCreateCategoryTreeOpenChange}
                      >
                        <SelectTrigger
                          id="transaction-category"
                          className="h-10 [&>span]:truncate"
                          aria-invalid={!!errors.categoryId}
                          tabIndex={4}
                          ref={createCategorySelectRef}
                        >
                          <SelectValue placeholder="Selecione categoria/subcategoria" />
                        </SelectTrigger>
                        <SelectContent
                          ref={createCategoryTreeContentRef}
                          onEscapeKeyDown={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            setIsCreateCategoryTreeOpen(false)
                          }}
                        >
                          <div className="px-2 pb-2">
                            <Input
                              placeholder="Buscar categoria ou subcategoria..."
                              className="h-9"
                              value={createCategoryTreeSearch}
                              onChange={(event) =>
                                setCreateCategoryTreeSearch(event.target.value)
                              }
                              onKeyDown={handleCreateCategoryTreeSearchKeyDown}
                              ref={createCategoryTreeSearchInputRef}
                            />
                          </div>
                          <SelectItem
                            value={CREATE_CATEGORY_TREE_NONE}
                            className="hidden"
                            textValue="none"
                          >
                            Selecione
                          </SelectItem>
                          <SelectItem
                            value={CREATE_CATEGORY_TREE_CREATE_CATEGORY}
                            onKeyDown={handleCreateCategoryTreeItemKeyDown}
                            textValue="create-category"
                          >
                            + Nova categoria
                          </SelectItem>
                          <SelectItem
                            value={CREATE_CATEGORY_TREE_CREATE_SUBCATEGORY}
                            onKeyDown={handleCreateCategoryTreeItemKeyDown}
                            textValue="create-subcategory"
                          >
                            + Nova subcategoria
                          </SelectItem>
                          {createCategoryTreeOptions.map(
                            (option, optionIndex) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                                onKeyDown={handleCreateCategoryTreeItemKeyDown}
                                textValue={`option-${optionIndex}`}
                                className={
                                  option.level === 'subcategory'
                                    ? 'pl-10 text-muted-foreground'
                                    : 'font-medium'
                                }
                              >
                                {option.label}
                              </SelectItem>
                            ),
                          )}
                          {createCategoryTreeOptions.length === 0 && (
                            <div className="px-2 py-2 text-sm text-muted-foreground">
                              Nenhuma categoria/subcategoria encontrada.
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.categoryId && (
                    <p className="text-sm text-destructive">
                      {errors.categoryId.message}
                    </p>
                  )}
                </div>
              </div>

              <div
                className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-2'}`}
              >
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
                        inputMode="decimal"
                        placeholder="$ 0,00"
                        className="h-10"
                        ref={createAmountRef}
                        value={field.value}
                        onChange={(event) => {
                          handleTransactionAmountChange(
                            event.target.value,
                            field.onChange,
                          )
                        }}
                        onKeyDown={(event) => {
                          if (event.key === '=') {
                            event.preventDefault()
                            field.onChange('=')
                            clearErrors('amount')
                          }
                        }}
                        onBlur={() => {
                          handleCreateAmountBlur(field.value, field.onChange)
                          field.onBlur()
                        }}
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
                            event.preventDefault()
                            event.stopPropagation()
                            setIsDescriptionSuggestionsOpen(false)
                          }
                        }}
                          autoComplete="off"
                          tabIndex={1}
                        />
                      {isDescriptionSuggestionsOpen && (
                        <div className="absolute z-10 mt-1 w-full rounded-md border bg-background shadow-lg">
                          {areDescriptionSuggestionsLoading ? (
                            <div className="px-3 py-2 text-sm text-muted-foreground">
                              {shouldFilterSuggestions
                                ? 'Buscando sugestões...'
                                : 'Carregando sugestões...'}
                            </div>
                          ) : hasDescriptionSuggestionsError ? (
                            <div className="px-3 py-2 text-sm text-destructive">
                              Erro ao carregar sugestões.
                            </div>
                          ) : descriptionSuggestions.length > 0 ? (
                            descriptionSuggestions.map((suggestion) => (
                              <button
                                key={suggestion}
                                type="button"
                                className={`flex w-full items-center px-3 py-2 text-left text-sm ${
                                  suggestion ===
                                  descriptionSuggestions[activeSuggestionIndex]
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

              <div className="rounded-md border border-border/70 bg-muted/20 p-3">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={isCreateRecurrenceEnabled}
                    onChange={(event) => {
                      const checked = event.target.checked
                      setIsCreateRecurrenceEnabled(checked)
                      if (checked) {
                        resetCreateRecurrenceDraft(createDate)
                      }
                    }}
                  />
                  <span>Tornar recorrente</span>
                </label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ative para configurar a regra recorrente com base nesta transação.
                </p>
              </div>

              {isCreateRecurrenceEnabled ? (
                <div className="space-y-2.5 rounded-md border border-sky-500/30 bg-sky-500/5 p-2.5 sm:space-y-3 sm:p-3">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold">Configuração da recorrência</h4>
                    <span className="rounded border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-600">
                      Prévia ativa
                    </span>
                  </div>

                  <div className="rounded-md border border-border/70 bg-background/70 p-2.5 sm:p-3">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Agenda</p>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Data de início</Label>
                        <Input
                          type="date"
                          value={createRecurrenceStartDate}
                          onChange={(event) => {
                            setCreateRecurrenceStartDate(event.target.value)
                            setIsCreateRecurrenceStartDateTouched(true)
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Frequência</Label>
                        <Select
                          value={createRecurrenceFrequency}
                          onValueChange={(value) =>
                            setCreateRecurrenceFrequency(
                              value as 'weekly' | 'biweekly' | 'monthly' | 'yearly',
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="weekly">Semanal</SelectItem>
                            <SelectItem value="biweekly">Quinzenal</SelectItem>
                            <SelectItem value="monthly">Mensal</SelectItem>
                            <SelectItem value="yearly">Anual</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      {(createRecurrenceFrequency === 'weekly' ||
                        createRecurrenceFrequency === 'biweekly') ? (
                        <div className="space-y-2">
                          <Label>Dia da semana</Label>
                          <Select
                            value={createRecurrenceDayOfWeek}
                            onValueChange={setCreateRecurrenceDayOfWeek}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">Domingo</SelectItem>
                              <SelectItem value="1">Segunda</SelectItem>
                              <SelectItem value="2">Terça</SelectItem>
                              <SelectItem value="3">Quarta</SelectItem>
                              <SelectItem value="4">Quinta</SelectItem>
                              <SelectItem value="5">Sexta</SelectItem>
                              <SelectItem value="6">Sábado</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      ) : null}

                      {(createRecurrenceFrequency === 'monthly' ||
                        createRecurrenceFrequency === 'yearly') ? (
                        <div className="space-y-2">
                          <Label>Dia do mês</Label>
                          <Input
                            type="number"
                            min={1}
                            max={31}
                            value={createRecurrenceDayOfMonth}
                            onChange={(event) =>
                              setCreateRecurrenceDayOfMonth(event.target.value)
                            }
                          />
                        </div>
                      ) : null}

                      {createRecurrenceFrequency === 'yearly' ? (
                        <div className="space-y-2">
                          <Label>Mês</Label>
                          <Input
                            type="number"
                            min={1}
                            max={12}
                            value={createRecurrenceMonthOfYear}
                            onChange={(event) =>
                              setCreateRecurrenceMonthOfYear(event.target.value)
                            }
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-md border border-border/70 bg-background/70 p-2.5 sm:p-3">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Término</p>
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label>Término</Label>
                        <Select
                          value={createRecurrenceEndType}
                          onValueChange={(value) =>
                            setCreateRecurrenceEndType(
                              value as 'never' | 'by_occurrences' | 'until_date',
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="never">Sem fim</SelectItem>
                            <SelectItem value="by_occurrences">Por ocorrências</SelectItem>
                            <SelectItem value="until_date">Por data final</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {createRecurrenceEndType === 'by_occurrences' ? (
                        <div className="space-y-2">
                          <Label>Qtd. ocorrências</Label>
                          <Input
                            type="number"
                            min={1}
                            value={createRecurrenceEndOccurrences}
                            onChange={(event) =>
                              setCreateRecurrenceEndOccurrences(event.target.value)
                            }
                          />
                        </div>
                      ) : null}
                      {createRecurrenceEndType === 'until_date' ? (
                        <div className="space-y-2">
                          <Label>Data final</Label>
                          <Input
                            type="date"
                            value={createRecurrenceEndDate}
                            onChange={(event) =>
                              setCreateRecurrenceEndDate(event.target.value)
                            }
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-md border border-sky-500/20 bg-background/60 p-2.5 text-[11px] text-muted-foreground sm:p-3 sm:text-xs">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Base da transação</p>
                    <div className="grid gap-1.5 sm:gap-2 md:grid-cols-2">
                      <p>
                        <strong className="text-foreground">Conta:</strong>{' '}
                        {createAccountName || 'Selecione'}
                      </p>
                      <p>
                        <strong className="text-foreground">Categoria:</strong>{' '}
                        {createCategory?.name || 'Selecione'}
                      </p>
                      <p>
                        <strong className="text-foreground">Subcategoria:</strong>{' '}
                        {createSubcategoryName || 'Nenhuma'}
                      </p>
                      <p>
                        <strong className="text-foreground">Valor:</strong>{' '}
                        {watch('amount') || '-'}
                      </p>
                      <p>
                        <strong className="text-foreground">Descrição:</strong>{' '}
                        {createDescription || '-'}
                      </p>
                      <p>
                        <strong className="text-foreground">Notas:</strong>{' '}
                        {(watch('notes') ?? '').trim() || '-'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {errors.root && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {errors.root.message}
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <ShortcutTooltip label="Atalho: Ctrl/Cmd+Shift+L">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto h-12 sm:h-auto"
                    onClick={handleClearCreateForm}
                  >
                    Limpar
                  </Button>
                </ShortcutTooltip>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                  <ShortcutTooltip label="Atalho: Esc">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full sm:w-auto h-12 sm:h-auto"
                      onClick={handleCloseCreateModal}
                    >
                      Cancelar
                    </Button>
                  </ShortcutTooltip>
                  <ShortcutTooltip label="Atalho: Ctrl/Cmd+Enter">
                    <Button
                      type="submit"
                      className="w-full sm:w-auto h-12 sm:h-auto"
                      disabled={isSubmitting}
                    >
                      Salvar
                    </Button>
                  </ShortcutTooltip>
                </div>
              </div>
            </form>
      </TransactionsCreateModal>

      {isCreateCategoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="fixed inset-0"
            onClick={() => setIsCreateCategoryOpen(false)}
          />
          <div className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-lg border bg-background p-4 shadow-lg sm:max-h-none sm:overflow-visible sm:p-6">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">Nova categoria</h3>
              <p className="text-sm text-muted-foreground">
                Crie uma categoria sem sair da transação.
              </p>
            </div>

            <form
              className="mt-6 space-y-4"
              onSubmit={submitCreateCategory}
            >
              <div className="space-y-2">
                <Label htmlFor="transaction-category-new-type">Tipo</Label>
                {(() => {
                  const typeRegister = categoryCreateForm.register('type')
                  return (
                    <select
                      id="transaction-category-new-type"
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      aria-invalid={!!categoryCreateForm.formState.errors.type}
                      {...typeRegister}
                      ref={(element) => {
                        typeRegister.ref(element)
                        categoryTypeRef.current = element
                      }}
                    >
                      <option value="">Selecione</option>
                      <option value="income">Receita</option>
                      <option value="expense">Despesa</option>
                    </select>
                  )
                })()}
                {categoryCreateForm.formState.errors.type && (
                  <p className="text-sm text-destructive">
                    {categoryCreateForm.formState.errors.type.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="transaction-category-new-name">Nome</Label>
                {(() => {
                  const nameRegister = categoryCreateForm.register('name')
                  return (
                    <Input
                      id="transaction-category-new-name"
                      placeholder="Ex: Alimentação"
                      className="h-10"
                      aria-invalid={!!categoryCreateForm.formState.errors.name}
                      {...nameRegister}
                      ref={(element) => {
                        nameRegister.ref(element)
                        categoryNameRef.current = element
                      }}
                    />
                  )
                })()}
                {categoryCreateForm.formState.errors.name && (
                  <p className="text-sm text-destructive">
                    {categoryCreateForm.formState.errors.name.message}
                  </p>
                )}
              </div>

              {categoryCreateForm.formState.errors.root?.message && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {categoryCreateForm.formState.errors.root.message}
                </div>
              )}

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <ShortcutTooltip label="Atalho: Esc">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => setIsCreateCategoryOpen(false)}
                  >
                    Cancelar
                  </Button>
                </ShortcutTooltip>
                <Button
                  type="submit"
                  className="w-full sm:w-auto"
                  disabled={createCategoryMutation.isPending}
                >
                  {createCategoryMutation.isPending ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isCreateSubcategoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="fixed inset-0"
            onClick={() => setIsCreateSubcategoryOpen(false)}
          />
          <div className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-lg border bg-background p-4 shadow-lg sm:max-h-none sm:overflow-visible sm:p-6">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">Nova subcategoria</h3>
              <p className="text-sm text-muted-foreground">
                Crie uma subcategoria sem sair da transação.
              </p>
            </div>

            <form
              className="mt-6 space-y-4"
              onSubmit={submitCreateSubcategory}
            >
              <div className="space-y-2">
                <Label htmlFor="transaction-subcategory-new-category">
                  Categoria
                </Label>
                <select
                  id="transaction-subcategory-new-category"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  aria-invalid={
                    !!subcategoryCreateForm.formState.errors.categoryId
                  }
                  {...subcategoryCreateForm.register('categoryId')}
                >
                  <option value="">Selecione</option>
                  {availableCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                {subcategoryCreateForm.formState.errors.categoryId && (
                  <p className="text-sm text-destructive">
                    {subcategoryCreateForm.formState.errors.categoryId.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="transaction-subcategory-new-name">Nome</Label>
                {(() => {
                  const nameRegister = subcategoryCreateForm.register('name')
                  return (
                    <Input
                      id="transaction-subcategory-new-name"
                      placeholder="Ex: Supermercado"
                      className="h-10"
                      aria-invalid={
                        !!subcategoryCreateForm.formState.errors.name
                      }
                      {...nameRegister}
                      ref={(element) => {
                        nameRegister.ref(element)
                        subcategoryNameRef.current = element
                      }}
                    />
                  )
                })()}
                {subcategoryCreateForm.formState.errors.name && (
                  <p className="text-sm text-destructive">
                    {subcategoryCreateForm.formState.errors.name.message}
                  </p>
                )}
              </div>

              {subcategoryCreateForm.formState.errors.root?.message && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {subcategoryCreateForm.formState.errors.root.message}
                </div>
              )}

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <ShortcutTooltip label="Atalho: Esc">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => setIsCreateSubcategoryOpen(false)}
                  >
                    Cancelar
                  </Button>
                </ShortcutTooltip>
                <Button
                  type="submit"
                  className="w-full sm:w-auto"
                  disabled={createSubcategoryMutation.isPending}
                >
                  {createSubcategoryMutation.isPending
                    ? 'Salvando...'
                    : 'Salvar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <TransactionsTransferModal
        isOpen={isTransferOpen}
        transferEditContext={transferEditContext}
        transferForm={transferForm}
        accounts={accountsQuery.data ?? []}
        isTransferFromAccountSelectOpen={isTransferFromAccountSelectOpen}
        setIsTransferFromAccountSelectOpen={setIsTransferFromAccountSelectOpen}
        isTransferToAccountSelectOpen={isTransferToAccountSelectOpen}
        setIsTransferToAccountSelectOpen={setIsTransferToAccountSelectOpen}
        isMobile={isMobile}
        transferAmountRef={transferAmountRef}
        onClose={handleCloseTransferModal}
        onSwapAccounts={handleSwapTransferAccounts}
        onSubmit={submitTransferForm}
        onDateFocus={handleDateFocus}
        onDateClick={handleDateClick}
        onDateKeyDown={handleMobileDateKeyDown}
        onDatePaste={handleMobileDatePaste}
        onTransferAmountChange={handleTransactionAmountChange}
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
        onOpenRepeatTransfer={handleOpenRepeatTransfer}
        onOpenDuplicate={handleOpenDuplicate}
        onOpenEdit={handleOpenEdit}
        onOpenEditTransfer={handleOpenEditTransfer}
        onOpenDelete={handleOpenDelete}
      />

      <TransactionsEditModal
        isOpen={isEditOpen}
        selectedTransaction={selectedTransaction}
        editControl={editControl}
        editRegister={editRegister}
        editErrors={editErrors}
        clearEditErrors={clearEditErrors}
        isEditFormSubmitting={isEditSubmitting}
        editType={editType}
        isMobile={isMobile}
        accounts={accountsQuery.data ?? []}
        isEditSubmitting={isEditSubmitting}
        isEditAccountSelectOpen={isEditAccountSelectOpen}
        setIsEditAccountSelectOpen={setIsEditAccountSelectOpen}
        isEditCategoryTreeOpen={isEditCategoryTreeOpen}
        editCategoryTreeSearch={editCategoryTreeSearch}
        setEditCategoryTreeSearch={setEditCategoryTreeSearch}
        editCategoryTreeOptions={editCategoryTreeOptions}
        editCategoryTreeContentRef={editCategoryTreeContentRef}
        editCategoryTreeSearchInputRef={editCategoryTreeSearchInputRef}
        editAmountRef={editAmountRef}
        getEditCategoryTreeValue={getEditCategoryTreeValue}
        handleEditCategoryTreeValueChange={handleEditCategoryTreeValueChange}
        handleEditCategoryTreeOpenChange={handleEditCategoryTreeOpenChange}
        handleEditCategoryTreeSearchKeyDown={handleEditCategoryTreeSearchKeyDown}
        handleEditCategoryTreeItemKeyDown={handleEditCategoryTreeItemKeyDown}
        handleTransactionAmountChange={handleTransactionAmountChange}
        onSubmit={submitEditTransaction}
        onClose={() => setIsEditOpen(false)}
        onDateFocus={handleDateFocus}
        onDateClick={handleDateClick}
        onDateKeyDown={handleMobileDateKeyDown}
        onDatePaste={handleMobileDatePaste}
        createCategoryTreeNoneValue={CREATE_CATEGORY_TREE_NONE}
        createCategoryTreeCreateCategoryValue={
          CREATE_CATEGORY_TREE_CREATE_CATEGORY
        }
        createCategoryTreeCreateSubcategoryValue={
          CREATE_CATEGORY_TREE_CREATE_SUBCATEGORY
        }
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
