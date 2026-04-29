import { zodResolver } from '@hookform/resolvers/zod'
import {
  useEffect,
  useRef,
  useState,
} from 'react'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { ShortcutTooltip } from '@/components/ui/shortcut-hint'
import type { Account } from '@/features/accounts'
import type { Category, Subcategory } from '@/features/categories'
import { useCreateCategory, useCreateSubcategory } from '@/features/categories'
import {
  type Transaction,
  useDebouncedValue,
  useTransactionForm,
  useTransactionsCreateSupport,
  useTransactionsInlineCategoryActions,
  useUpdateTransaction,
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


type TransactionsEditModalProps = {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  transaction: Transaction | null
  accounts?: Account[]
  categories?: Category[]
  availableCategories?: Category[]
}


export function TransactionsEditModal(
  props: TransactionsEditModalProps,
) {
  const {
    isOpen,
    onClose,
    onSuccess,
    transaction,
    accounts = [],
    categories = [],
    availableCategories = [],
  } = props
  const isMobile = useMediaQuery('(max-width: 639px)')
  const [isEditAccountSelectOpen, setIsEditAccountSelectOpen] = useState(false)
  const [isEditCategoryTreeOpen, setIsEditCategoryTreeOpen] = useState(false)
  const [isCreateCategoryOpen, setIsCreateCategoryOpen] = useState(false)
  const [isCreateSubcategoryOpen, setIsCreateSubcategoryOpen] = useState(false)
  const [editCategoryTreeSearch, setEditCategoryTreeSearch] = useState('')
  const [lastCreatedSubcategory, setLastCreatedSubcategory] =
    useState<Subcategory | null>(null)
  const [isDescriptionSuggestionsOpen, setIsDescriptionSuggestionsOpen] = useState(false)
  const [isDescriptionFocused, setIsDescriptionFocused] = useState(false)
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0)

  const editAmountRef = useRef<HTMLInputElement | null>(null)
  const editDescriptionInputRef = useRef<HTMLInputElement | null>(null)
  const editCategoryTreeSearchInputRef = useRef<HTMLInputElement | null>(null)
  const editCategoryTreeContentRef = useRef<HTMLDivElement | null>(null)
  const categoryTypeRef = useRef<HTMLSelectElement | null>(null)
  const categoryNameRef = useRef<HTMLInputElement | null>(null)
  const subcategoryNameRef = useRef<HTMLInputElement | null>(null)
  const lastEditCategoryId = useRef<string | null>(null)

  const updateTransactionMutation = useUpdateTransaction()
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
      accountId: transaction?.accountId ?? '',
      categoryId: transaction?.categoryId ?? '',
      subcategoryId: transaction?.subcategoryId ?? '',
      type: transaction?.type ?? '',
      amount: transaction ? `$ ${formatCurrencyValue(transaction.amount)}` : '',
      date: transaction?.date ?? '',
      description: transaction?.description ?? '',
      notes: transaction?.notes ?? '',
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

  const editCategoryId = watch('categoryId')
  const editSubcategoryId = watch('subcategoryId')
  const editTypeRaw = watch('type')
  const editType: 'income' | 'expense' | '' =
    editTypeRaw === 'income' || editTypeRaw === 'expense' ? editTypeRaw : ''
  const editCategory = categories.find((item) => item.id === editCategoryId)
  const editDescription = watch('description') ?? ''
  const debouncedEditDescription = useDebouncedValue(editDescription, 1000)

  const {
    editCategoryTreeOptions,
    descriptionSuggestions,
    areDescriptionSuggestionsLoading,
    hasDescriptionSuggestionsError,
    shouldFilterSuggestions,
  } = useTransactionsCreateSupport({
    availableCategories,
    createCategoryIdsKey: availableCategories.map((category) => category.id).join('|'),
    createCategoryId: editCategoryId,
    createSubcategoryId: editSubcategoryId ?? '',
    createAccountId: watch('accountId'),
    createCategoryTreeSearch: '',
    editCategoryTreeSearch,
    debouncedCreateDescription: debouncedEditDescription,
    isCreateOpen: false,
    isEditOpen: isOpen,
    lastCreatedSubcategory,
    accounts,
  })

  const transactionForm = useTransactionForm({
    mode: 'edit',
    selectedTransactionId: transaction?.id ?? null,
    updateTransaction: updateTransactionMutation.mutateAsync,
    onEditSuccess: () => {
      onSuccess()
      onClose()
    },
    setEditRootError: (message) => {
      setError('root', { message })
    },
  })

  const { submitCreateCategory, submitCreateSubcategory } =
    useTransactionsInlineCategoryActions({
      createCategoryModalTarget: 'edit',
      createSubcategoryModalTarget: 'edit',
      createCategoryId: editCategoryId,
      categoryCreateForm,
      subcategoryCreateForm,
      createCategory: createCategoryMutation.mutateAsync,
      createSubcategory: createSubcategoryMutation.mutateAsync,
      setIsCreateCategoryOpen,
      setIsCreateSubcategoryOpen,
      setLastCreatedSubcategory,
      pendingCategorySelection: { current: null },
      pendingSubcategorySelection: { current: null },
      lastCreateCategoryId: { current: null },
      lastEditCategoryId,
      createCategorySelectRef: { current: null },
      setCreateValue: setValue,
      setEditValue: setValue,
    })

  useEffect(() => {
    if (!editCategoryId) {
      setValue('type', '')
      setValue('subcategoryId', '')
      lastEditCategoryId.current = null
      return
    }

    if (lastEditCategoryId.current !== editCategoryId) {
      setValue('subcategoryId', '')
      lastEditCategoryId.current = editCategoryId
    }

    if (editCategory?.type) {
      setValue('type', editCategory.type)
    }
  }, [editCategory?.type, editCategoryId, setValue])

  useEffect(() => {
    if (!isOpen || !transaction) {
      return
    }

    clearErrors()
    lastEditCategoryId.current = transaction.categoryId
    reset({
      accountId: transaction.accountId,
      categoryId: transaction.categoryId,
      subcategoryId: transaction.subcategoryId ?? '',
      type: transaction.type,
      amount: `$ ${formatCurrencyValue(transaction.amount)}`,
      date: transaction.date,
      description: transaction.description ?? '',
      notes: transaction.notes ?? '',
    })

    window.setTimeout(() => {
      const editDescriptionInput = document.getElementById(
        'transaction-edit-description',
      ) as HTMLInputElement | null
      editDescriptionInput?.focus()
    }, 0)
  }, [clearErrors, isOpen, reset, transaction])

  useEffect(() => {
    if (!isOpen || !transaction) {
      return
    }

    if (!watch('accountId')) {
      setValue('accountId', transaction.accountId)
    }
    if (!watch('categoryId')) {
      setValue('categoryId', transaction.categoryId)
    }
    if (!watch('type')) {
      setValue('type', transaction.type)
    }
  }, [isOpen, setValue, transaction, watch])

  useEffect(() => {
    if (!isCreateCategoryOpen) {
      return
    }
    categoryCreateForm.reset({ name: '', type: editType || '' })
    const focusId = window.setTimeout(() => {
      categoryTypeRef.current?.focus()
    }, 0)
    return () => window.clearTimeout(focusId)
  }, [categoryCreateForm, editType, isCreateCategoryOpen])

  useEffect(() => {
    if (!isCreateSubcategoryOpen) {
      return
    }
    subcategoryCreateForm.reset({
      categoryId:
        editCategoryId || availableCategories.find((category) => !category.system)?.id || '',
      name: '',
    })
    const focusId = window.setTimeout(() => {
      subcategoryNameRef.current?.focus()
    }, 0)
    return () => window.clearTimeout(focusId)
  }, [availableCategories, editCategoryId, isCreateSubcategoryOpen, subcategoryCreateForm])

  useEffect(() => {
    setActiveSuggestionIndex(0)
  }, [descriptionSuggestions.length, isDescriptionSuggestionsOpen])

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
        if (isEditCategoryTreeOpen) {
          setIsEditCategoryTreeOpen(false)
          return
        }
        if (isEditAccountSelectOpen) {
          setIsEditAccountSelectOpen(false)
          return
        }
        onClose()
        return
      }

      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault()
        void handleSubmit(transactionForm.onSubmit)()
        return
      }

      if (!event.altKey || event.metaKey || event.ctrlKey) {
        return
      }

      const fieldMap = {
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
      } as const
      const fieldId = fieldMap[event.code as keyof typeof fieldMap]
      if (fieldId) {
        event.preventDefault()
        document.getElementById(fieldId)?.focus()
      }
    }

    window.addEventListener('keydown', handleShortcut, true)
    return () => window.removeEventListener('keydown', handleShortcut, true)
  }, [
    handleSubmit,
    isCreateCategoryOpen,
    isCreateSubcategoryOpen,
    isDescriptionSuggestionsOpen,
    isEditAccountSelectOpen,
    isEditCategoryTreeOpen,
    isOpen,
    onClose,
    transactionForm.onSubmit,
  ])

  const {
    getCategoryTreeValue: getEditCategoryTreeValue,
    handleCategoryTreeOpenChange: handleEditCategoryTreeOpenChange,
    handleCategoryTreeSelectValueChange: handleEditCategoryTreeValueChange,
    handleCategoryTreeSearchKeyDown: handleEditCategoryTreeSearchKeyDown,
    handleCategoryTreeItemKeyDown: handleEditCategoryTreeItemKeyDown,
  } = useCategoryTreeInteraction({
    categoryId: editCategoryId,
    subcategoryId: editSubcategoryId ?? '',
    contentRef: editCategoryTreeContentRef,
    searchInputRef: editCategoryTreeSearchInputRef,
    setSearch: setEditCategoryTreeSearch,
    setIsOpen: setIsEditCategoryTreeOpen,
    setIsCreateCategoryOpen,
    setIsCreateSubcategoryOpen,
    setValue,
    lastCategoryId: lastEditCategoryId,
  })

  if (!isOpen || !transaction) {
    return null
  }

  const isTransferTransaction = Boolean(transaction.transferId)

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="fixed inset-0" onClick={onClose} />
        <div className="relative w-full max-w-2xl max-h-[90dvh] overflow-y-auto rounded-lg border bg-background p-4 shadow-lg sm:max-h-none sm:overflow-visible sm:p-6">
          <div>
            <h3 className="text-lg font-semibold">Editar transação</h3>
            <p className="text-sm text-muted-foreground">
              Atualize os dados da transação selecionada.
            </p>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit(transactionForm.onSubmit)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <TransactionAccountField
                id="transaction-edit-account"
                label="Conta"
                control={control}
                errors={errors}
                accounts={accounts}
                isOpen={isEditAccountSelectOpen}
                onOpenChange={setIsEditAccountSelectOpen}
                tabIndex={7}
              />

              <TransactionDateField
                id="transaction-edit-date"
                register={register}
                errors={errors}
                isMobile={isMobile}
                tabIndex={6}
              />
            </div>

            <div className="grid gap-4">
              <TransactionCategoryField
                id="transaction-edit-category"
                control={control}
                errors={errors}
                isOpen={isEditCategoryTreeOpen}
                options={editCategoryTreeOptions}
                search={editCategoryTreeSearch}
                onSearchChange={(value) => {
                  setEditCategoryTreeSearch(value)
                  window.requestAnimationFrame(() => {
                    editCategoryTreeSearchInputRef.current?.focus()
                  })
                }}
                contentRef={editCategoryTreeContentRef}
                searchInputRef={editCategoryTreeSearchInputRef}
                tabIndex={4}
                disabled={isTransferTransaction}
                disabledMessage={
                  isTransferTransaction
                    ? 'Categoria e subcategoria de transferências não podem ser alteradas.'
                    : undefined
                }
                getCategoryTreeValue={getEditCategoryTreeValue}
                onValueChange={handleEditCategoryTreeValueChange}
                onOpenChange={handleEditCategoryTreeOpenChange}
                onSearchKeyDown={handleEditCategoryTreeSearchKeyDown}
                onItemKeyDown={handleEditCategoryTreeItemKeyDown}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <TransactionTypeField
                id="transaction-edit-type"
                register={register}
                errors={errors}
                type={editType}
              />

              <TransactionAmountField
                id="transaction-edit-amount"
                control={control}
                errors={errors}
                amountRef={editAmountRef}
                clearAmountError={() => clearErrors('amount')}
                setAmountError={(message) => {
                  setError('amount', { type: 'manual', message })
                }}
                tabIndex={3}
                inputMode="numeric"
              />
            </div>

            <TransactionDescriptionField
              id="transaction-edit-description"
              register={register}
              errors={errors}
              descriptionInputRef={editDescriptionInputRef}
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
              id="transaction-edit-notes"
              register={register}
              errors={errors}
              tabIndex={2}
            />

            {errors.root && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {errors.root.message}
              </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <ShortcutTooltip label="Atalho: Esc">
                <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onClose}>
                  Cancelar
                </Button>
              </ShortcutTooltip>
              <ShortcutTooltip label="Atalho: Ctrl/Cmd+Enter">
                <Button type="submit" className="w-full sm:w-auto" disabled={isSubmitting}>
                  Atualizar
                </Button>
              </ShortcutTooltip>
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
