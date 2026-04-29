import { zodResolver } from '@hookform/resolvers/zod'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useForm } from 'react-hook-form'

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
import type { Account } from '@/features/accounts'
import type { Category, Subcategory } from '@/features/categories'
import { useCreateCategory, useCreateSubcategory } from '@/features/categories'
import { useCreateRecurrence } from '@/features/recurrences'
import {
  formatDateInput,
  type Transaction,
  useCreateTransaction,
  useDebouncedValue,
  useDeleteTransaction,
  useTransactionForm,
  useTransactionRecurrenceDraft,
  useTransactionsCreateSupport,
  useTransactionsInlineCategoryActions,
} from '@/features/transactions'
import { useMediaQuery } from '@/hooks/useMediaQuery'
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

import { useCategoryTreeInteraction } from '../hooks/use-category-tree-interaction'

import { TransactionAccountField } from './transaction-account-field'
import { TransactionAmountField } from './transaction-amount-field'
import { TransactionCategoryField } from './transaction-category-field'
import { TransactionDateField } from './transaction-date-field'
import { TransactionDescriptionField } from './transaction-description-field'
import { TransactionNotesField } from './transaction-notes-field'
import { TransactionTypeField } from './transaction-type-field'
import { TransactionsInlineCategoryFlow } from './transactions-inline-category-flow'


type TransactionsCreateModalProps = {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  accounts?: Account[]
  categories?: Category[]
  availableCategories?: Category[]
  primaryAccountId?: string
  defaultTransferToAccountId?: string
  draftTransaction?: Transaction | null
  onDraftHandled?: () => void
}


export function TransactionsCreateModal(
  props: TransactionsCreateModalProps,
) {
  const {
    isOpen,
    onClose,
    onSuccess,
    accounts = [],
    categories = [],
    availableCategories = [],
    primaryAccountId = '',
    draftTransaction = null,
    onDraftHandled,
  } = props
  const isMobile = useMediaQuery('(max-width: 639px)')
  const [isCreateCategoryOpen, setIsCreateCategoryOpen] = useState(false)
  const [isCreateSubcategoryOpen, setIsCreateSubcategoryOpen] = useState(false)
  const [isCreateAccountSelectOpen, setIsCreateAccountSelectOpen] = useState(false)
  const [isCreateCategoryTreeOpen, setIsCreateCategoryTreeOpen] = useState(false)
  const [isDescriptionSuggestionsOpen, setIsDescriptionSuggestionsOpen] =
    useState(false)
  const [isDescriptionFocused, setIsDescriptionFocused] = useState(false)
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0)
  const [createCategoryTreeSearch, setCreateCategoryTreeSearch] = useState('')
  const [lastCreatedSubcategory, setLastCreatedSubcategory] =
    useState<Subcategory | null>(null)

  const pendingCategorySelection = useRef<string | null>(null)
  const pendingSubcategorySelection = useRef<{
    categoryId: string
    subcategoryId: string
  } | null>(null)
  const lastCreateCategoryId = useRef<string | null>(null)
  const isCreateFromDuplicate = useRef(false)
  const initializedOpenRef = useRef(false)
  const createAmountRef = useRef<HTMLInputElement | null>(null)
  const descriptionInputRef = useRef<HTMLInputElement | null>(null)
  const dateInputRef = useRef<HTMLInputElement | null>(null)
  const createCategorySelectRef = useRef<HTMLButtonElement | null>(null)
  const createCategoryTreeSearchInputRef = useRef<HTMLInputElement | null>(null)
  const createCategoryTreeContentRef = useRef<HTMLDivElement | null>(null)
  const subcategoryNameRef = useRef<HTMLInputElement | null>(null)
  const categoryNameRef = useRef<HTMLInputElement | null>(null)
  const categoryTypeRef = useRef<HTMLSelectElement | null>(null)

  const createTransactionMutation = useCreateTransaction()
  const createRecurrenceMutation = useCreateRecurrence()
  const deleteTransactionMutation = useDeleteTransaction()
  const createCategoryMutation = useCreateCategory()
  const createSubcategoryMutation = useCreateSubcategory()

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
    defaultValues: { name: '', type: '' },
  })

  const subcategoryCreateForm = useForm<SubcategoryCreateFormData>({
    resolver: zodResolver(subcategoryCreateSchema),
    defaultValues: { categoryId: '', name: '' },
  })

  const createCategoryId = watch('categoryId')
  const createSubcategoryId = watch('subcategoryId')
  const createDescription = watch('description') ?? ''
  const createAmount = watch('amount') ?? ''
  const createNotes = watch('notes') ?? ''
  const createAccountId = watch('accountId')
  const createDate = watch('date')
  const createTypeRaw = watch('type')
  const createType: 'income' | 'expense' | '' =
    createTypeRaw === 'income' || createTypeRaw === 'expense'
      ? createTypeRaw
      : ''

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

  const createCategory = categories.find((item: Category) => item.id === createCategoryId)
  const createCategoryIdsKey = useMemo(
    () => availableCategories.map((category: Category) => category.id).join('|'),
    [availableCategories],
  )
  const debouncedCreateDescription = useDebouncedValue(createDescription, 1000)
  const {
    createSubcategories,
    createSubcategoryName,
    createAccountName,
    createCategoryTreeOptions,
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
    editCategoryTreeSearch: '',
    debouncedCreateDescription,
    isCreateOpen: isOpen,
    isEditOpen: false,
    lastCreatedSubcategory,
    accounts,
  })

  const transactionForm = useTransactionForm({
    mode: 'create',
    isCreateRecurrenceEnabled,
    recurrenceDraft,
    createTransaction: createTransactionMutation.mutateAsync,
    createRecurrence: createRecurrenceMutation.mutateAsync,
    deleteTransaction: deleteTransactionMutation.mutateAsync,
    selectedTransactionId: null,
    updateTransaction: async () => undefined,
    onCreateSuccess: () => {
      resetCreateForm()
      onSuccess()
      onClose()
    },
    onEditSuccess: () => {},
    setCreateRootError: (message) => {
      setError('root', { message })
    },
    setEditRootError: () => {},
    setCreateAmountError: (message) => {
      setError('amount', { type: 'manual', message })
    },
    clearCreateAmountError: () => {
      clearErrors('amount')
    },
  })

  const { submitCreateCategory, submitCreateSubcategory } =
    useTransactionsInlineCategoryActions({
      createCategoryModalTarget: 'create',
      createSubcategoryModalTarget: 'create',
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
      lastEditCategoryId: { current: null },
      createCategorySelectRef,
      setCreateValue: setValue,
      setEditValue: setValue,
    })

  const resetCreateForm = useMemo(
    () => () => {
      isCreateFromDuplicate.current = false
      lastCreateCategoryId.current = null
      pendingCategorySelection.current = null
      pendingSubcategorySelection.current = null
      setIsCreateRecurrenceEnabled(false)
      resetCreateRecurrenceDraft()
      setIsCreateAccountSelectOpen(false)
      setIsCreateCategoryTreeOpen(false)
      setCreateCategoryTreeSearch('')
      setIsDescriptionSuggestionsOpen(false)
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
    },
    [
      clearErrors,
      primaryAccountId,
      reset,
      resetCreateRecurrenceDraft,
      setIsCreateRecurrenceEnabled,
    ],
  )

  useEffect(() => {
    setActiveSuggestionIndex(0)
  }, [descriptionSuggestions.length, isDescriptionSuggestionsOpen])

  useEffect(() => {
    if (!isOpen || draftTransaction || !primaryAccountId || createAccountId) {
      return
    }

    setValue('accountId', primaryAccountId)
  }, [createAccountId, draftTransaction, isOpen, primaryAccountId, setValue])

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
  }, [createCategory?.type, createCategoryId, setValue])

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
  }, [categories, setValue])

  useEffect(() => {
    const pending = pendingSubcategorySelection.current
    if (!pending || pending.categoryId !== createCategoryId) {
      return
    }
    if (!createSubcategories.some((subcategory) => subcategory.id === pending.subcategoryId)) {
      return
    }
    setValue('subcategoryId', pending.subcategoryId, {
      shouldDirty: true,
      shouldTouch: true,
    })
    pendingSubcategorySelection.current = null
  }, [createCategoryId, createSubcategories, setValue])

  useEffect(() => {
    if (!isOpen) {
      initializedOpenRef.current = false
      return
    }

    if (initializedOpenRef.current) {
      return
    }

    initializedOpenRef.current = true
    clearErrors('root')

    if (draftTransaction && !draftTransaction.transferId) {
      isCreateFromDuplicate.current = true
      lastCreateCategoryId.current = draftTransaction.categoryId
      reset({
        accountId: draftTransaction.accountId,
        categoryId: draftTransaction.categoryId,
        subcategoryId: draftTransaction.subcategoryId ?? '',
        type: draftTransaction.type,
        amount: `$ ${formatCurrencyValue(draftTransaction.amount)}`,
        date: formatDateInput(new Date()),
        description: draftTransaction.description ?? '',
        notes: draftTransaction.notes ?? '',
      })
      setIsCreateRecurrenceEnabled(false)
      resetCreateRecurrenceDraft(formatDateInput(new Date()))
      onDraftHandled?.()
      window.setTimeout(() => dateInputRef.current?.focus(), 0)
      return
    }

    resetCreateForm()
    window.setTimeout(() => descriptionInputRef.current?.focus(), 0)
  }, [
    clearErrors,
    draftTransaction,
    isOpen,
    onDraftHandled,
    reset,
    resetCreateForm,
    resetCreateRecurrenceDraft,
    setIsCreateRecurrenceEnabled,
  ])

  useEffect(() => {
    if (!isCreateCategoryOpen) {
      return
    }
    categoryCreateForm.reset({ name: '', type: createType || '' })
    const focusId = window.setTimeout(() => {
      categoryTypeRef.current?.focus()
    }, 0)
    return () => window.clearTimeout(focusId)
  }, [categoryCreateForm, createType, isCreateCategoryOpen])

  useEffect(() => {
    if (!isCreateSubcategoryOpen) {
      return
    }

    subcategoryCreateForm.reset({
      categoryId:
        createCategoryId || availableCategories.find((category: Category) => !category.system)?.id || '',
      name: '',
    })
    const focusId = window.setTimeout(() => {
      subcategoryNameRef.current?.focus()
    }, 0)
    return () => window.clearTimeout(focusId)
  }, [
    availableCategories,
    createCategoryId,
    isCreateSubcategoryOpen,
    subcategoryCreateForm,
  ])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleShortcut = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isCreateSubcategoryOpen) {
          setIsCreateSubcategoryOpen(false)
          return
        }
        if (isCreateCategoryOpen) {
          setIsCreateCategoryOpen(false)
          return
        }
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
        onClose()
        return
      }

      if (event.altKey && !event.metaKey && !event.ctrlKey) {
        const fieldMap = {
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
        } as const
        const fieldId = fieldMap[event.code as keyof typeof fieldMap]
        if (fieldId) {
          event.preventDefault()
          document.getElementById(fieldId)?.focus()
          return
        }
      }

      if (event.metaKey || event.ctrlKey) {
        if (event.shiftKey && event.key.toLowerCase() === 'l') {
          event.preventDefault()
          resetCreateForm()
          return
        }
        if (event.key === 'Enter') {
          event.preventDefault()
          void handleSubmit(transactionForm.onSubmit)()
        }
      }
    }

    window.addEventListener('keydown', handleShortcut, true)
    return () => window.removeEventListener('keydown', handleShortcut, true)
  }, [
    handleSubmit,
    isCreateAccountSelectOpen,
    isCreateCategoryOpen,
    isCreateCategoryTreeOpen,
    isCreateSubcategoryOpen,
    isDescriptionSuggestionsOpen,
    isOpen,
    onClose,
    resetCreateForm,
    transactionForm.onSubmit,
  ])

  const {
    getCategoryTreeValue: getCreateCategoryTreeValue,
    handleCategoryTreeOpenChange: handleCreateCategoryTreeOpenChange,
    handleCategoryTreeSelectValueChange: handleCreateCategoryTreeSelectValueChange,
    handleCategoryTreeSearchKeyDown: handleCreateCategoryTreeSearchKeyDown,
    handleCategoryTreeItemKeyDown: handleCreateCategoryTreeItemKeyDown,
  } = useCategoryTreeInteraction({
    categoryId: createCategoryId,
    subcategoryId: createSubcategoryId ?? '',
    contentRef: createCategoryTreeContentRef,
    searchInputRef: createCategoryTreeSearchInputRef,
    setSearch: setCreateCategoryTreeSearch,
    setIsOpen: setIsCreateCategoryTreeOpen,
    setIsCreateCategoryOpen,
    setIsCreateSubcategoryOpen,
    setValue,
    lastCategoryId: lastCreateCategoryId,
  })

  if (!isOpen) {
    return null
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="fixed inset-0" onClick={onClose} />
        <div className="relative w-full max-w-2xl max-h-[90dvh] overflow-y-auto overscroll-contain rounded-lg border bg-background p-4 shadow-lg sm:p-6">
          <div>
            <h3 className="text-lg font-semibold">Nova transação</h3>
            <p className="text-sm text-muted-foreground">
              Preencha os dados para registrar uma nova transação.
            </p>
          </div>

          <form
            className="mt-6 space-y-4 pb-10 sm:pb-0"
            onSubmit={handleSubmit(transactionForm.onSubmit)}
          >
            <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-2'}`}>
              <TransactionAccountField
                id="transaction-account"
                label="Conta"
                control={control}
                errors={errors}
                accounts={accounts}
                isOpen={isCreateAccountSelectOpen}
                onOpenChange={setIsCreateAccountSelectOpen}
                tabIndex={7}
              />

              <TransactionDateField
                id="transaction-date"
                register={register}
                errors={errors}
                isMobile={isMobile}
                tabIndex={6}
                dateRef={dateInputRef}
              />
            </div>

            <div className="grid gap-4">
              <TransactionCategoryField
                id="transaction-category"
                control={control}
                errors={errors}
                isOpen={isCreateCategoryTreeOpen}
                options={createCategoryTreeOptions}
                search={createCategoryTreeSearch}
                onSearchChange={setCreateCategoryTreeSearch}
                contentRef={createCategoryTreeContentRef}
                searchInputRef={createCategoryTreeSearchInputRef}
                triggerRef={createCategorySelectRef}
                tabIndex={4}
                getCategoryTreeValue={getCreateCategoryTreeValue}
                onValueChange={handleCreateCategoryTreeSelectValueChange}
                onOpenChange={handleCreateCategoryTreeOpenChange}
                onSearchKeyDown={handleCreateCategoryTreeSearchKeyDown}
                onItemKeyDown={handleCreateCategoryTreeItemKeyDown}
              />
            </div>

            <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-2'}`}>
              <TransactionTypeField
                id="transaction-type"
                register={register}
                errors={errors}
                type={createType}
              />

              <TransactionAmountField
                id="transaction-amount"
                control={control}
                errors={errors}
                amountRef={createAmountRef}
                onAmountChange={transactionForm.handleTransactionAmountChange}
                clearAmountError={() => clearErrors('amount')}
                onAmountBlur={transactionForm.handleCreateAmountBlur}
                tabIndex={3}
              />
            </div>

            <TransactionDescriptionField
              id="transaction-description"
              register={register}
              errors={errors}
              descriptionInputRef={descriptionInputRef}
              setValue={setValue}
              descriptionSuggestions={descriptionSuggestions}
              areDescriptionSuggestionsLoading={areDescriptionSuggestionsLoading}
              hasDescriptionSuggestionsError={hasDescriptionSuggestionsError}
              shouldFilterSuggestions={shouldFilterSuggestions}
              isDescriptionSuggestionsOpen={isDescriptionSuggestionsOpen}
              setIsDescriptionSuggestionsOpen={setIsDescriptionSuggestionsOpen}
              isDescriptionFocused={isDescriptionFocused}
              setIsDescriptionFocused={setIsDescriptionFocused}
              activeSuggestionIndex={activeSuggestionIndex}
              setActiveSuggestionIndex={setActiveSuggestionIndex}
            />

            <TransactionNotesField
              id="transaction-notes"
              register={register}
              errors={errors}
              tabIndex={2}
            />

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
                        <Select value={createRecurrenceDayOfWeek} onValueChange={setCreateRecurrenceDayOfWeek}>
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
                          onChange={(event) => setCreateRecurrenceDayOfMonth(event.target.value)}
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
                          onChange={(event) => setCreateRecurrenceMonthOfYear(event.target.value)}
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
                          onChange={(event) => setCreateRecurrenceEndOccurrences(event.target.value)}
                        />
                      </div>
                    ) : null}
                    {createRecurrenceEndType === 'until_date' ? (
                      <div className="space-y-2">
                        <Label>Data final</Label>
                        <Input
                          type="date"
                          value={createRecurrenceEndDate}
                          onChange={(event) => setCreateRecurrenceEndDate(event.target.value)}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-md border border-sky-500/20 bg-background/60 p-2.5 text-[11px] text-muted-foreground sm:p-3 sm:text-xs">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Base da transação</p>
                  <div className="grid gap-1.5 sm:gap-2 md:grid-cols-2">
                    <p><strong className="text-foreground">Conta:</strong> {createAccountName || 'Selecione'}</p>
                    <p><strong className="text-foreground">Categoria:</strong> {createCategory?.name || 'Selecione'}</p>
                    <p><strong className="text-foreground">Subcategoria:</strong> {createSubcategoryName || 'Nenhuma'}</p>
                    <p><strong className="text-foreground">Valor:</strong> {createAmount || '-'}</p>
                    <p><strong className="text-foreground">Descrição:</strong> {createDescription || '-'}</p>
                    <p><strong className="text-foreground">Notas:</strong> {createNotes.trim() || '-'}</p>
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
                  onClick={resetCreateForm}
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
                    onClick={onClose}
                  >
                    Cancelar
                  </Button>
                </ShortcutTooltip>
                <ShortcutTooltip label="Atalho: Ctrl/Cmd+Enter">
                  <Button type="submit" className="w-full sm:w-auto h-12 sm:h-auto" disabled={isSubmitting}>
                    Salvar
                  </Button>
                </ShortcutTooltip>
              </div>
            </div>
          </form>
        </div>
      </div>

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
    </>
  )
}
