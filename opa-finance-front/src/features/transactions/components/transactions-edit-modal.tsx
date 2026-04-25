import { zodResolver } from '@hookform/resolvers/zod'
import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type FocusEvent,
  type FormEvent,
  type KeyboardEvent,
  type KeyboardEventHandler,
  type MouseEvent,
} from 'react'
import { Controller, useForm } from 'react-hook-form'

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
import {
  type Transaction,
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

import { TransactionsInlineCategoryFlow } from './transactions-inline-category-flow'

type CategoryTreeOption = {
  value: string
  label: string
  level: 'category' | 'subcategory'
}

type TransactionsEditModalAutonomousProps = {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  transaction: Transaction | null
  accounts?: Account[]
  categories?: Category[]
  availableCategories?: Category[]
}

type TransactionsEditModalLegacyProps = {
  isOpen: boolean
  selectedTransaction: Transaction | null
  editControl: any
  editRegister: any
  editErrors: any
  clearEditErrors: (name?: keyof TransactionCreateFormData) => void
  editType: 'income' | 'expense' | ''
  isMobile: boolean
  accounts: Account[]
  isEditSubmitting: boolean
  isEditAccountSelectOpen: boolean
  setIsEditAccountSelectOpen: (open: boolean) => void
  isEditCategoryTreeOpen: boolean
  editCategoryTreeSearch: string
  setEditCategoryTreeSearch: (value: string) => void
  editCategoryTreeOptions: CategoryTreeOption[]
  editCategoryTreeContentRef: { current: HTMLDivElement | null }
  editCategoryTreeSearchInputRef: { current: HTMLInputElement | null }
  editAmountRef: { current: HTMLInputElement | null }
  getEditCategoryTreeValue: () => string
  handleEditCategoryTreeValueChange: (
    value: string,
    onChange: (value: string) => void,
  ) => void
  handleEditCategoryTreeOpenChange: (open: boolean) => void
  handleEditCategoryTreeSearchKeyDown: KeyboardEventHandler<HTMLInputElement>
  handleEditCategoryTreeItemKeyDown: KeyboardEventHandler<HTMLDivElement>
  handleTransactionAmountChange: (rawValue: string, onChange: (value: string) => void) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onClose: () => void
  onDateFocus: (event: FocusEvent<HTMLInputElement>) => void
  onDateClick: (event: MouseEvent<HTMLInputElement>) => void
  onDateKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
  onDatePaste: (event: ClipboardEvent<HTMLInputElement>) => void
  createCategoryTreeNoneValue: string
  createCategoryTreeCreateCategoryValue: string
  createCategoryTreeCreateSubcategoryValue: string
}

type TransactionsEditModalProps =
  | TransactionsEditModalAutonomousProps
  | TransactionsEditModalLegacyProps

const CREATE_CATEGORY_TREE_NONE = '__none__'
const CREATE_CATEGORY_TREE_CREATE_CATEGORY = '__create_category__'
const CREATE_CATEGORY_TREE_CREATE_SUBCATEGORY = '__create_subcategory__'

export function TransactionsEditModal(props: TransactionsEditModalProps) {
  if ('selectedTransaction' in props) {
    return <TransactionsEditModalLegacy {...props} />
  }

  return (
    <TransactionsEditModalAutonomous
      {...(props as TransactionsEditModalAutonomousProps)}
    />
  )
}

function TransactionsEditModalLegacy(props: TransactionsEditModalLegacyProps) {
  const {
    isOpen,
    selectedTransaction,
    editControl,
    editRegister,
    editErrors,
    clearEditErrors,
    editType,
    isMobile,
    accounts,
    isEditSubmitting,
    isEditAccountSelectOpen,
    setIsEditAccountSelectOpen,
    isEditCategoryTreeOpen,
    editCategoryTreeSearch,
    setEditCategoryTreeSearch,
    editCategoryTreeOptions,
    editCategoryTreeContentRef,
    editCategoryTreeSearchInputRef,
    editAmountRef,
    getEditCategoryTreeValue,
    handleEditCategoryTreeValueChange,
    handleEditCategoryTreeOpenChange,
    handleEditCategoryTreeSearchKeyDown,
    handleEditCategoryTreeItemKeyDown,
    handleTransactionAmountChange,
    onSubmit,
    onClose,
    onDateFocus,
    onDateClick,
    onDateKeyDown,
    onDatePaste,
    createCategoryTreeNoneValue,
    createCategoryTreeCreateCategoryValue,
    createCategoryTreeCreateSubcategoryValue,
  } = props

  if (!isOpen || !selectedTransaction) {
    return null
  }

  const isTransferTransaction = Boolean(selectedTransaction.transferId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="fixed inset-0" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90dvh] overflow-y-auto rounded-lg border bg-background p-4 shadow-lg sm:max-h-none sm:overflow-visible sm:p-6">
        <div>
          <h3 className="text-lg font-semibold">Editar transação</h3>
          <p className="text-sm text-muted-foreground">
            Atualize os dados da transação selecionada.
          </p>
        </div>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="transaction-edit-account">Conta</Label>
              <Controller
                control={editControl}
                name="accountId"
                render={({ field }) => (
                  <Select
                    open={isEditAccountSelectOpen}
                    value={field.value ? field.value : '__none__'}
                    onValueChange={(value) =>
                      field.onChange(value === '__none__' ? '' : value)
                    }
                    onOpenChange={setIsEditAccountSelectOpen}
                  >
                    <SelectTrigger
                      id="transaction-edit-account"
                      className="h-10"
                      aria-invalid={!!editErrors.accountId}
                      tabIndex={7}
                    >
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent
                      onEscapeKeyDown={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        setIsEditAccountSelectOpen(false)
                      }}
                    >
                      <SelectItem value="__none__" className="hidden">Selecione</SelectItem>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {editErrors.accountId && <p className="text-sm text-destructive">{editErrors.accountId.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="transaction-edit-date">Data</Label>
              <Input
                id="transaction-edit-date"
                type="date"
                className="h-10"
                aria-invalid={!!editErrors.date}
                onFocus={onDateFocus}
                inputMode={isMobile ? 'none' : undefined}
                tabIndex={6}
                {...editRegister('date')}
                onClick={onDateClick}
                onKeyDown={onDateKeyDown}
                onPaste={onDatePaste}
              />
              {editErrors.date && <p className="text-sm text-destructive">{editErrors.date.message}</p>}
            </div>
          </div>

          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="transaction-edit-category">Categoria/Subcategoria</Label>
              <Controller
                control={editControl}
                name="categoryId"
                render={({ field }) => (
                  <Select
                    open={isEditCategoryTreeOpen}
                    disabled={isTransferTransaction}
                    value={getEditCategoryTreeValue()}
                    onValueChange={(value) => handleEditCategoryTreeValueChange(value, field.onChange)}
                    onOpenChange={handleEditCategoryTreeOpenChange}
                  >
                    <SelectTrigger
                      id="transaction-edit-category"
                      className="h-10 [&>span]:truncate"
                      aria-invalid={!!editErrors.categoryId}
                      tabIndex={4}
                    >
                      <SelectValue placeholder="Selecione categoria/subcategoria" />
                    </SelectTrigger>
                    <SelectContent
                      ref={editCategoryTreeContentRef}
                        onEscapeKeyDown={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          handleEditCategoryTreeOpenChange(false)
                        }}
                      >
                        <div className="px-2 pb-2">
                          <Input
                            placeholder="Buscar categoria ou subcategoria..."
                            className="h-9"
                            value={editCategoryTreeSearch}
                            onChange={(event) => {
                              setEditCategoryTreeSearch(event.target.value)
                              window.requestAnimationFrame(() => {
                                editCategoryTreeSearchInputRef.current?.focus()
                              })
                            }}
                            onKeyDown={handleEditCategoryTreeSearchKeyDown}
                            ref={editCategoryTreeSearchInputRef}
                          />
                        </div>
                        <SelectItem value={createCategoryTreeNoneValue} className="hidden" textValue="none">
                          Selecione
                        </SelectItem>
                        <SelectItem value={createCategoryTreeCreateCategoryValue} onKeyDown={handleEditCategoryTreeItemKeyDown} textValue="create-category">
                          + Nova categoria
                        </SelectItem>
                        <SelectItem value={createCategoryTreeCreateSubcategoryValue} onKeyDown={handleEditCategoryTreeItemKeyDown} textValue="create-subcategory">
                          + Nova subcategoria
                        </SelectItem>
                        {editCategoryTreeOptions.map((option, optionIndex) => (
                          <SelectItem
                            key={option.value}
                            value={option.value}
                            onKeyDown={handleEditCategoryTreeItemKeyDown}
                            textValue={`option-${optionIndex}`}
                            className={option.level === 'subcategory' ? 'pl-10 text-muted-foreground' : 'font-medium'}
                          >
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {editErrors.categoryId && <p className="text-sm text-destructive">{editErrors.categoryId.message}</p>}
                {editErrors.subcategoryId && <p className="text-sm text-destructive">{editErrors.subcategoryId.message}</p>}
                {isTransferTransaction && (
                  <p className="text-xs text-muted-foreground">
                    Categoria e subcategoria de transferências não podem ser alteradas.
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="transaction-edit-type">Tipo</Label>
                <input type="hidden" {...editRegister('type')} />
                <Input id="transaction-edit-type" className="h-10 cursor-not-allowed bg-muted/30" readOnly tabIndex={-1} placeholder="Receita/Despesa" aria-invalid={!!editErrors.type} value={editType === 'income' ? 'Receita' : editType === 'expense' ? 'Despesa' : ''} />
                {editErrors.type && <p className="text-sm text-destructive">{editErrors.type.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="transaction-edit-amount">Valor</Label>
                <Controller
                  control={editControl}
                  name="amount"
                  render={({ field }) => (
                    <Input id="transaction-edit-amount" type="text" inputMode="numeric" placeholder="$ 0,00" className="h-10" ref={editAmountRef} value={field.value} onChange={(event) => { handleTransactionAmountChange(event.target.value, field.onChange) }} onKeyDown={(event) => { if (event.key === '=') { event.preventDefault(); field.onChange('='); clearEditErrors('amount') } }} aria-invalid={!!editErrors.amount} tabIndex={3} />
                  )}
                />
                {editErrors.amount && <p className="text-sm text-destructive">{editErrors.amount.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="transaction-edit-description">Descrição</Label>
              <Input id="transaction-edit-description" placeholder="Ex: Supermercado" className="h-10" aria-invalid={!!editErrors.description} tabIndex={1} {...editRegister('description')} />
              {editErrors.description && <p className="text-sm text-destructive">{editErrors.description.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="transaction-edit-notes">Notas</Label>
              <Input id="transaction-edit-notes" placeholder="Opcional" className="h-10" aria-invalid={!!editErrors.notes} tabIndex={2} {...editRegister('notes')} />
              {editErrors.notes && <p className="text-sm text-destructive">{editErrors.notes.message}</p>}
            </div>

            {editErrors.root && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{editErrors.root.message}</div>}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <ShortcutTooltip label="Atalho: Esc">
                <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onClose}>
                  Cancelar
                </Button>
              </ShortcutTooltip>
              <ShortcutTooltip label="Atalho: Ctrl/Cmd+Enter">
                <Button type="submit" className="w-full sm:w-auto" disabled={isEditSubmitting}>
                  Atualizar
                </Button>
              </ShortcutTooltip>
            </div>
          </form>
        </div>
      </div>
    )
}

function TransactionsEditModalAutonomous(
  props: TransactionsEditModalAutonomousProps,
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

  const editAmountRef = useRef<HTMLInputElement | null>(null)
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

  const { editCategoryTreeOptions } = useTransactionsCreateSupport({
    availableCategories,
    createCategoryIdsKey: availableCategories.map((category) => category.id).join('|'),
    createCategoryId: editCategoryId,
    createSubcategoryId: editSubcategoryId ?? '',
    createAccountId: watch('accountId'),
    createCategoryTreeSearch: '',
    editCategoryTreeSearch,
    debouncedCreateDescription: '',
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
    isEditAccountSelectOpen,
    isEditCategoryTreeOpen,
    isOpen,
    onClose,
    transactionForm.onSubmit,
  ])

  const findVisibleSiblingOption = (
    element: HTMLElement,
    direction: 'prev' | 'next',
  ) => {
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
  }

  const focusEditCategoryOption = (direction: 'up' | 'down') => {
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
  }

  const getEditCategoryTreeValue = () => {
    if (!editCategoryId) {
      return CREATE_CATEGORY_TREE_NONE
    }
    if (editSubcategoryId) {
      return `subcategory:${editCategoryId}:${editSubcategoryId}`
    }
    return `category:${editCategoryId}`
  }

  const handleEditCategoryTreeOpenChange = (open: boolean) => {
    setIsEditCategoryTreeOpen(open)
    if (!open) {
      setEditCategoryTreeSearch('')
      return
    }
    window.requestAnimationFrame(() => {
      editCategoryTreeSearchInputRef.current?.focus()
    })
  }

  const handleEditCategoryTreeValueChange = (
    value: string,
    onCategoryChange: (value: string) => void,
  ) => {
    if (value === CREATE_CATEGORY_TREE_CREATE_CATEGORY) {
      setEditCategoryTreeSearch('')
      setIsCreateCategoryOpen(true)
      return
    }
    if (value === CREATE_CATEGORY_TREE_CREATE_SUBCATEGORY) {
      setEditCategoryTreeSearch('')
      setIsCreateSubcategoryOpen(true)
      return
    }
    if (value === CREATE_CATEGORY_TREE_NONE) {
      setEditCategoryTreeSearch('')
      onCategoryChange('')
      setValue('subcategoryId', '', {
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
  }

  const handleEditCategoryTreeSearchKeyDown: KeyboardEventHandler<HTMLInputElement> =
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
      if (isTypingKey || event.key === 'Backspace' || event.key === 'Delete') {
        event.stopPropagation()
        event.nativeEvent.stopImmediatePropagation?.()
        return
      }
      event.stopPropagation()
    }

  const handleEditCategoryTreeItemKeyDown = (
    event: Parameters<KeyboardEventHandler<HTMLDivElement>>[0],
  ) => {
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
  }

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
              <div className="space-y-2">
                <Label htmlFor="transaction-edit-account">Conta</Label>
                <Controller
                  control={control}
                  name="accountId"
                  render={({ field }) => (
                    <Select
                      open={isEditAccountSelectOpen}
                      value={field.value ? field.value : '__none__'}
                      onValueChange={(value) =>
                        field.onChange(value === '__none__' ? '' : value)
                      }
                      onOpenChange={setIsEditAccountSelectOpen}
                    >
                      <SelectTrigger
                        id="transaction-edit-account"
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
                          setIsEditAccountSelectOpen(false)
                        }}
                      >
                        <SelectItem value="__none__" className="hidden">Selecione</SelectItem>
                        {accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.accountId && <p className="text-sm text-destructive">{errors.accountId.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="transaction-edit-date">Data</Label>
                <Input
                  id="transaction-edit-date"
                  type="date"
                  className="h-10"
                  aria-invalid={!!errors.date}
                  onFocus={(event) => {
                    if (!isMobile) {
                      return
                    }
                    const input = event.currentTarget
                    if (typeof input.showPicker === 'function') {
                      input.showPicker()
                    }
                  }}
                  inputMode={isMobile ? 'none' : undefined}
                  tabIndex={6}
                  {...register('date')}
                  onClick={(event) => {
                    const target = event.currentTarget
                    if (typeof target.showPicker !== 'function') {
                      return
                    }
                    if (isMobile || event.detail > 0) {
                      target.showPicker()
                    }
                  }}
                  onKeyDown={(event) => {
                    if (isMobile) {
                      event.preventDefault()
                    }
                  }}
                  onPaste={(event) => {
                    if (isMobile) {
                      event.preventDefault()
                    }
                  }}
                />
                {errors.date && <p className="text-sm text-destructive">{errors.date.message}</p>}
              </div>
            </div>

            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="transaction-edit-category">Categoria/Subcategoria</Label>
                <Controller
                  control={control}
                  name="categoryId"
                  render={({ field }) => (
                    <Select
                      open={isEditCategoryTreeOpen}
                      disabled={isTransferTransaction}
                      value={getEditCategoryTreeValue()}
                      onValueChange={(value) => handleEditCategoryTreeValueChange(value, field.onChange)}
                      onOpenChange={handleEditCategoryTreeOpenChange}
                    >
                      <SelectTrigger
                        id="transaction-edit-category"
                        className="h-10 [&>span]:truncate"
                        aria-invalid={!!errors.categoryId}
                        tabIndex={4}
                      >
                        <SelectValue placeholder="Selecione categoria/subcategoria" />
                      </SelectTrigger>
                      <SelectContent
                        ref={editCategoryTreeContentRef}
                        onEscapeKeyDown={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          handleEditCategoryTreeOpenChange(false)
                        }}
                      >
                        <div className="px-2 pb-2">
                          <Input
                            placeholder="Buscar categoria ou subcategoria..."
                            className="h-9"
                            value={editCategoryTreeSearch}
                            onChange={(event) => {
                              setEditCategoryTreeSearch(event.target.value)
                              window.requestAnimationFrame(() => {
                                editCategoryTreeSearchInputRef.current?.focus()
                              })
                            }}
                            onKeyDown={handleEditCategoryTreeSearchKeyDown}
                            onKeyUp={(event) => {
                              const isTypingKey =
                                (event.key.length === 1 ||
                                  event.key === 'Dead' ||
                                  event.key === 'Backspace' ||
                                  event.key === 'Delete') &&
                                !event.ctrlKey &&
                                !event.metaKey &&
                                !event.altKey
                              if (isTypingKey) {
                                event.stopPropagation()
                                event.nativeEvent.stopImmediatePropagation?.()
                              }
                            }}
                            ref={editCategoryTreeSearchInputRef}
                          />
                        </div>
                        <SelectItem value={CREATE_CATEGORY_TREE_NONE} className="hidden" textValue="none">
                          Selecione
                        </SelectItem>
                        <SelectItem
                          value={CREATE_CATEGORY_TREE_CREATE_CATEGORY}
                          onKeyDown={handleEditCategoryTreeItemKeyDown}
                          textValue="create-category"
                        >
                          + Nova categoria
                        </SelectItem>
                        <SelectItem
                          value={CREATE_CATEGORY_TREE_CREATE_SUBCATEGORY}
                          onKeyDown={handleEditCategoryTreeItemKeyDown}
                          textValue="create-subcategory"
                        >
                          + Nova subcategoria
                        </SelectItem>
                        {editCategoryTreeOptions.map((option: CategoryTreeOption, optionIndex) => (
                          <SelectItem
                            key={option.value}
                            value={option.value}
                            onKeyDown={handleEditCategoryTreeItemKeyDown}
                            textValue={`option-${optionIndex}`}
                            className={
                              option.level === 'subcategory'
                                ? 'pl-10 text-muted-foreground'
                                : 'font-medium'
                            }
                          >
                            {option.label}
                          </SelectItem>
                        ))}
                        {editCategoryTreeOptions.length === 0 && (
                          <div className="px-2 py-2 text-sm text-muted-foreground">
                            Nenhuma categoria/subcategoria encontrada.
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.categoryId && <p className="text-sm text-destructive">{errors.categoryId.message}</p>}
                {errors.subcategoryId && <p className="text-sm text-destructive">{errors.subcategoryId.message}</p>}
                {isTransferTransaction && (
                  <p className="text-xs text-muted-foreground">
                    Categoria e subcategoria de transferências não podem ser alteradas.
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="transaction-edit-type">Tipo</Label>
                <input type="hidden" {...register('type')} />
                <Input
                  id="transaction-edit-type"
                  className="h-10 cursor-not-allowed bg-muted/30"
                  readOnly
                  tabIndex={-1}
                  placeholder="Receita/Despesa"
                  aria-invalid={!!errors.type}
                  value={
                    editType === 'income'
                      ? 'Receita'
                      : editType === 'expense'
                        ? 'Despesa'
                        : ''
                  }
                />
                {errors.type && <p className="text-sm text-destructive">{errors.type.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="transaction-edit-amount">Valor</Label>
                <Controller
                  control={control}
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
                      onChange={(event) => {
                        transactionForm.handleTransactionAmountChange(
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
                      aria-invalid={!!errors.amount}
                      tabIndex={3}
                    />
                  )}
                />
                {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="transaction-edit-description">Descrição</Label>
              <Input
                id="transaction-edit-description"
                placeholder="Ex: Supermercado"
                className="h-10"
                aria-invalid={!!errors.description}
                tabIndex={1}
                {...register('description')}
              />
              {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="transaction-edit-notes">Notas</Label>
              <Input
                id="transaction-edit-notes"
                placeholder="Opcional"
                className="h-10"
                aria-invalid={!!errors.notes}
                tabIndex={2}
                {...register('notes')}
              />
              {errors.notes && <p className="text-sm text-destructive">{errors.notes.message}</p>}
            </div>

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
