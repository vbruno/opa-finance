import { useEffect, useMemo, useRef, useState } from 'react'
import { type UseFormReturn } from 'react-hook-form'

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
import { type Account } from '@/features/accounts'
import { type Category, type Subcategory } from '@/features/categories'
import { type Recurrence } from '@/features/recurrences'
import {
  RECURRENCE_DAY_OF_WEEK_OPTIONS,
  RECURRENCE_MONTH_OPTIONS,
  RECURRENCE_POSTING_MODE_LABELS,
  RECURRENCE_POSTING_MODES,
} from '@/features/recurrences/model/recurrences.constants'
import { getDayOfWeekFromIsoDate } from '@/features/recurrences/model/recurrences.helpers'
import { useCategoryTreeInteraction } from '@/features/transactions/hooks/use-category-tree-interaction'
import { buildCategoryTreeOptions } from '@/features/transactions/model/transactions-page.helpers'
import { type RecurrenceFormData } from '@/schemas/recurrence.schema'

import { TransactionAccountField } from '../../transactions/components/transaction-account-field'
import { TransactionAmountField } from '../../transactions/components/transaction-amount-field'
import { TransactionCategoryField } from '../../transactions/components/transaction-category-field'
import { TransactionDateField } from '../../transactions/components/transaction-date-field'
import { TransactionDescriptionField } from '../../transactions/components/transaction-description-field'
import { TransactionNotesField } from '../../transactions/components/transaction-notes-field'

type RecurrenceFormModalProps = {
  open: boolean
  isEditing: boolean
  isOccurrenceEdit: boolean
  occurrenceEditStatus?: 'projected' | 'pending_review'
  isSingleScopeEdit: boolean
  isAnyMutationPending: boolean
  isFormSupportDataLoading: boolean
  isSubcategoriesError: boolean
  formError: string | null
  conflictRecurrenceId: string | null
  isConflictRefetching: boolean
  editingRecurrence: Recurrence | null
  isGlobalStructureLocked: boolean
  accounts: Account[]
  categories: Category[]
  subcategoriesByCategory: Record<string, Subcategory[]>
  descriptionSuggestions: string[]
  areDescriptionSuggestionsLoading: boolean
  hasDescriptionSuggestionsError: boolean
  shouldFilterSuggestions: boolean
  originType: RecurrenceFormData['originType']
  editScope: RecurrenceFormData['editScope']
  form: UseFormReturn<RecurrenceFormData>
  onClose: () => void
  onSubmit: (values: RecurrenceFormData) => Promise<void>
  onReloadAfterConflict: () => Promise<void>
  onSubcategoriesRefetch: () => void
}

export function RecurrenceFormModal({
  open,
  isEditing,
  isOccurrenceEdit,
  occurrenceEditStatus,
  isSingleScopeEdit,
  isAnyMutationPending,
  isFormSupportDataLoading,
  isSubcategoriesError,
  formError,
  conflictRecurrenceId,
  isConflictRefetching,
  editingRecurrence,
  isGlobalStructureLocked,
  accounts,
  categories,
  subcategoriesByCategory,
  descriptionSuggestions,
  areDescriptionSuggestionsLoading,
  hasDescriptionSuggestionsError,
  shouldFilterSuggestions,
  originType,
  editScope,
  form,
  onClose,
  onSubmit,
  onReloadAfterConflict,
  onSubcategoriesRefetch,
}: RecurrenceFormModalProps) {
  const modalRef = useRef<HTMLDivElement | null>(null)
  const selectedCategoryId = form.watch('categoryId')
  const postingMode = form.watch('postingMode')
  const endType = form.watch('endType')
  const frequency = form.watch('frequency')
  const errors = form.formState.errors
  const [isAccountSelectOpen, setIsAccountSelectOpen] = useState(false)
  const [isCategoryTreeOpen, setIsCategoryTreeOpen] = useState(false)
  const [categoryTreeSearch, setCategoryTreeSearch] = useState('')
  const [isDescriptionSuggestionsOpen, setIsDescriptionSuggestionsOpen] =
    useState(false)
  const [isDescriptionFocused, setIsDescriptionFocused] = useState(false)
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0)
  const amountRef = useRef<HTMLInputElement | null>(null)
  const descriptionInputRef = useRef<HTMLInputElement | null>(null)
  const categoryTreeSearchInputRef = useRef<HTMLInputElement | null>(null)
  const categoryTreeContentRef = useRef<HTMLDivElement | null>(null)
  const lastCategoryId = useRef<string | null>(null)
  const lastStartDate = useRef<string | null>(null)
  const dayOfWeek = form.watch('dayOfWeek')
  const startDate = form.watch('startDate')
  const isWeeklyFrequency = frequency === 'weekly' || frequency === 'biweekly'
  const selectedDayOfWeekLabel = useMemo(
    () =>
      RECURRENCE_DAY_OF_WEEK_OPTIONS.find((option) => option.value === dayOfWeek)
        ?.label ?? 'Definido pela data inicial',
    [dayOfWeek],
  )

  const isEditingActive = isEditing && editingRecurrence?.status === 'active'
  const isStructuralFieldsDisabled = isSingleScopeEdit || isGlobalStructureLocked
  const hasFormErrors = Object.keys(form.formState.errors).length > 0
  const isSubmitDisabled =
    isAnyMutationPending || isFormSupportDataLoading || Boolean(isSubcategoriesError)

  const categoryTreeOptions = useMemo(
    () =>
      buildCategoryTreeOptions({
        categories,
        subcategoriesByCategory,
        search: categoryTreeSearch,
      }),
    [categories, categoryTreeSearch, subcategoriesByCategory],
  )

  const {
    getCategoryTreeValue,
    handleCategoryTreeOpenChange,
    handleCategoryTreeSelectValueChange,
    handleCategoryTreeSearchKeyDown,
    handleCategoryTreeItemKeyDown,
  } = useCategoryTreeInteraction({
    categoryId: selectedCategoryId ?? '',
    subcategoryId: form.watch('subcategoryId') ?? '',
    contentRef: categoryTreeContentRef,
    searchInputRef: categoryTreeSearchInputRef,
    setSearch: setCategoryTreeSearch,
    setIsOpen: setIsCategoryTreeOpen,
    setIsCreateCategoryOpen: () => undefined,
    setIsCreateSubcategoryOpen: () => undefined,
    setValue: (name, value, options) => {
      form.setValue(name, value, options)
    },
    lastCategoryId,
  })

  useEffect(() => {
    if (!open) return

    setIsAccountSelectOpen(false)
    setIsCategoryTreeOpen(false)
    setCategoryTreeSearch('')
    setIsDescriptionSuggestionsOpen(false)
    setIsDescriptionFocused(false)
    setActiveSuggestionIndex(0)
    lastCategoryId.current = null
    lastStartDate.current = form.getValues('startDate') ?? null

    const id = window.setTimeout(() => {
      modalRef.current?.focus()
    }, 0)

    return () => window.clearTimeout(id)
  }, [form, open])

  useEffect(() => {
    if (!open || isSingleScopeEdit) return

    const previousStartDate = lastStartDate.current
    lastStartDate.current = startDate ?? null

    if (!isWeeklyFrequency || !startDate || previousStartDate === startDate) {
      return
    }

    const nextDayOfWeek = getDayOfWeekFromIsoDate(startDate)
    if (nextDayOfWeek && nextDayOfWeek !== form.getValues('dayOfWeek')) {
      form.setValue('dayOfWeek', nextDayOfWeek, {
        shouldDirty: true,
        shouldValidate: true,
      })
    }
  }, [form, isSingleScopeEdit, isWeeklyFrequency, open, startDate])

  useEffect(() => {
    if (!open) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="recurrence-form-modal-title"
        className="relative flex w-full max-w-5xl max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl sm:max-h-[calc(100dvh-2rem)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b px-4 py-3 sm:px-5">
          <h2
            id="recurrence-form-modal-title"
            className="text-base font-semibold sm:text-lg"
          >
            {isOccurrenceEdit ? 'Editar ocorrência' : isEditing ? 'Editar recorrência' : 'Nova recorrência'}
          </h2>
        </div>

        <form className="flex flex-1 min-h-0 flex-col" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 sm:px-5">
            <div className="space-y-4">
              {isGlobalStructureLocked ? (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
                  Recorrência ativada. Apenas descrição, observações e valor são editáveis.
                </div>
              ) : null}

              {/* 1. Modo de lançamento | Origem | Frequência */}
              {!isOccurrenceEdit && (
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                <div className="min-w-0">
                  <Label htmlFor="recurrence-posting-mode">Modo de lançamento</Label>
                  <Select
                    value={postingMode || '__none__'}
                    onValueChange={(value) =>
                      form.setValue(
                        'postingMode',
                        value === '__none__' ? '' as RecurrenceFormData['postingMode'] : value as RecurrenceFormData['postingMode'],
                      )
                    }
                    disabled={isStructuralFieldsDisabled}
                  >
                    <SelectTrigger id="recurrence-posting-mode">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__" className="hidden">Selecione</SelectItem>
                      {RECURRENCE_POSTING_MODES.map((mode) => (
                        <SelectItem key={mode} value={mode}>
                          {RECURRENCE_POSTING_MODE_LABELS[mode]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.postingMode ? (
                    <p className="text-sm text-destructive">
                      {String(errors.postingMode.message)}
                    </p>
                  ) : null}
                </div>

                <div className="min-w-0">
                  <Label htmlFor="recurrence-origin-type">Origem</Label>
                  <Select
                    value={originType}
                    onValueChange={(value) => {
                      form.setValue(
                        'originType',
                        value as 'transaction' | 'transfer',
                      )
                      form.setValue('accountId', '')
                      form.setValue('categoryId', '')
                      form.setValue('subcategoryId', '')
                      form.setValue('fromAccountId', '')
                      form.setValue('toAccountId', '')
                    }}
                    disabled={isEditing || isGlobalStructureLocked}
                  >
                    <SelectTrigger id="recurrence-origin-type">
                      <SelectValue placeholder="Origem" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="transaction">Transação</SelectItem>
                      <SelectItem value="transfer">Transferência</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="min-w-0">
                  <Label htmlFor="recurrence-frequency">Frequência</Label>
                  <Select
                    value={frequency}
                    onValueChange={(value) => {
                      const nextFrequency =
                        value as RecurrenceFormData['frequency']

                      form.setValue('frequency', nextFrequency)

                      if (nextFrequency === 'weekly' || nextFrequency === 'biweekly') {
                        form.setValue('dayOfMonth', '')
                        form.setValue('monthOfYear', '')
                        const nextDayOfWeek = getDayOfWeekFromIsoDate(
                          form.getValues('startDate'),
                        )
                        if (nextDayOfWeek) {
                          form.setValue('dayOfWeek', nextDayOfWeek, {
                            shouldDirty: true,
                            shouldValidate: true,
                          })
                        }
                      } else if (nextFrequency === 'monthly') {
                        form.setValue('dayOfWeek', '')
                        form.setValue('monthOfYear', '')
                      } else if (nextFrequency === 'yearly') {
                        form.setValue('dayOfWeek', '')
                      }
                    }}
                    disabled={isStructuralFieldsDisabled}
                  >
                    <SelectTrigger id="recurrence-frequency">
                      <SelectValue placeholder="Frequência" />
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
              )}

              {/* 2. Data inicial | Dia do mês/semana [| Mês] */}
              {!isOccurrenceEdit && (
              <div
                className={
                  frequency === 'yearly'
                    ? 'grid grid-cols-1 gap-3 xl:grid-cols-3'
                    : 'grid grid-cols-1 gap-3 xl:grid-cols-2'
                }
              >
                <div className="min-w-0">
                  <TransactionDateField
                    id="recurrence-start-date"
                    label="Data inicial"
                    fieldName="startDate"
                    register={form.register}
                    errors={form.formState.errors}
                    isMobile={false}
                    disabled={isStructuralFieldsDisabled}
                  />
                </div>

                {isWeeklyFrequency && (
                  <div className="min-w-0">
                    <Label htmlFor="recurrence-day-of-week">Dia da semana</Label>
                    <Input
                      id="recurrence-day-of-week"
                      value={selectedDayOfWeekLabel}
                      readOnly
                      tabIndex={-1}
                      aria-readonly="true"
                      className="h-10 pointer-events-none cursor-default text-muted-foreground"
                    />
                  </div>
                )}

                {(frequency === 'monthly' || frequency === 'yearly') && (
                  <div className="min-w-0">
                    <Label htmlFor="recurrence-day-of-month">Dia do mês</Label>
                    <Input
                      id="recurrence-day-of-month"
                      type="number"
                      min={1}
                      max={31}
                      className="h-10 w-full"
                      {...form.register('dayOfMonth')}
                      aria-invalid={!!errors.dayOfMonth}
                      disabled={isStructuralFieldsDisabled}
                    />
                    {errors.dayOfMonth ? (
                      <p className="text-sm text-destructive">
                        {String(errors.dayOfMonth.message)}
                      </p>
                    ) : null}
                  </div>
                )}

                {frequency === 'yearly' && (
                  <div className="min-w-0">
                    <Label htmlFor="recurrence-month-of-year">Mês</Label>
                    <Select
                      value={form.watch('monthOfYear') || '__none__'}
                      onValueChange={(value) =>
                        form.setValue(
                          'monthOfYear',
                          value === '__none__' ? '' : value,
                        )
                      }
                      disabled={isStructuralFieldsDisabled}
                    >
                      <SelectTrigger
                        id="recurrence-month-of-year"
                        aria-invalid={!!errors.monthOfYear}
                      >
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Selecione</SelectItem>
                        {RECURRENCE_MONTH_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.monthOfYear ? (
                      <p className="text-sm text-destructive">
                        {String(errors.monthOfYear.message)}
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
              )}

              {/* 3. Término | Data final / Qtd. ocorrências */}
              {!isOccurrenceEdit && (
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
                <div className="min-w-0">
                  <Label htmlFor="recurrence-end-type">Término</Label>
                  <Select
                    value={endType}
                    onValueChange={(value) => {
                      const nextEndType = value as RecurrenceFormData['endType']

                      form.setValue(
                        'endType',
                        nextEndType,
                        { shouldDirty: true, shouldValidate: true },
                      )

                      if (nextEndType === 'never') {
                        form.setValue('endOccurrences', '', {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
                        form.setValue('endDate', '', {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
                      }

                      if (nextEndType === 'by_occurrences') {
                        form.setValue('endDate', '', {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
                      }

                      if (nextEndType === 'until_date') {
                        form.setValue('endOccurrences', '', {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
                      }
                    }}
                    disabled={isStructuralFieldsDisabled}
                  >
                    <SelectTrigger id="recurrence-end-type">
                      <SelectValue placeholder="Término" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never">Sem fim</SelectItem>
                      <SelectItem value="by_occurrences">Por ocorrências</SelectItem>
                      <SelectItem value="until_date">Por data final</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {endType === 'by_occurrences' && (
                  <div className="min-w-0">
                    <Label htmlFor="recurrence-end-occurrences">Qtd. ocorrências</Label>
                    <Input
                      id="recurrence-end-occurrences"
                      type="number"
                      min={1}
                      className="h-10"
                      {...form.register('endOccurrences')}
                      aria-invalid={!!errors.endOccurrences}
                      disabled={isStructuralFieldsDisabled}
                    />
                    {errors.endOccurrences ? (
                      <p className="text-sm text-destructive">
                        {String(errors.endOccurrences.message)}
                      </p>
                    ) : null}
                  </div>
                )}

                {endType === 'until_date' && (
                  <div className="min-w-0">
                    <Label htmlFor="recurrence-end-date">Data final</Label>
                    <Input
                      id="recurrence-end-date"
                      type="date"
                      className="h-10"
                      {...form.register('endDate')}
                      aria-invalid={!!errors.endDate}
                      disabled={isStructuralFieldsDisabled}
                    />
                    {errors.endDate ? (
                      <p className="text-sm text-destructive">
                        {String(errors.endDate.message)}
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
              )}

              {/* 4. Descrição */}
              <div className="min-w-0">
                <TransactionDescriptionField
                  id="recurrence-description"
                  register={form.register}
                  errors={form.formState.errors}
                  descriptionInputRef={descriptionInputRef}
                  setValue={form.setValue}
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
                  enableSuggestions={true}
                />
              </div>

              {/* 5. Observações */}
              <div className="min-w-0">
                <TransactionNotesField
                  id="recurrence-notes"
                  label="Observações"
                  register={form.register}
                  errors={form.formState.errors}
                />
              </div>

              {/* 6. Conta | Valor  /  Conta origem | Conta destino */}
              {isOccurrenceEdit ? (
                <div className="min-w-0">
                  <TransactionAmountField
                    id="recurrence-amount"
                    control={form.control}
                    errors={form.formState.errors}
                    amountRef={amountRef}
                    clearAmountError={() => form.clearErrors('amount')}
                    setAmountError={(message) => {
                      form.setError('amount', { type: 'manual', message })
                    }}
                    inputMode="numeric"
                    disabled={isGlobalStructureLocked}
                  />
                </div>
              ) : originType === 'transaction' ? (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <div className="min-w-0">
                    <TransactionAccountField
                      id="recurrence-account"
                      label="Conta"
                      control={form.control}
                      errors={form.formState.errors}
                      accounts={accounts}
                      isOpen={isAccountSelectOpen}
                      onOpenChange={setIsAccountSelectOpen}
                      disabled={isGlobalStructureLocked}
                    />
                  </div>
                  <div className="min-w-0">
                    <TransactionAmountField
                      id="recurrence-amount"
                      control={form.control}
                      errors={form.formState.errors}
                      amountRef={amountRef}
                      clearAmountError={() => form.clearErrors('amount')}
                      setAmountError={(message) => {
                        form.setError('amount', { type: 'manual', message })
                      }}
                      inputMode="numeric"
                      disabled={isGlobalStructureLocked}
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <div className="min-w-0">
                    <Label>Conta origem</Label>
                    <Select
                      value={form.watch('fromAccountId') || '__none__'}
                      onValueChange={(value) =>
                        form.setValue(
                          'fromAccountId',
                          value === '__none__' ? '' : value,
                        )
                      }
                      disabled={isGlobalStructureLocked}
                    >
                      <SelectTrigger aria-invalid={!!errors.fromAccountId}>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Selecione</SelectItem>
                        {accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.fromAccountId ? (
                      <p className="text-sm text-destructive">
                        {String(errors.fromAccountId.message)}
                      </p>
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <Label>Conta destino</Label>
                    <Select
                      value={form.watch('toAccountId') || '__none__'}
                      onValueChange={(value) =>
                        form.setValue(
                          'toAccountId',
                          value === '__none__' ? '' : value,
                        )
                      }
                      disabled={isGlobalStructureLocked}
                    >
                      <SelectTrigger aria-invalid={!!errors.toAccountId}>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Selecione</SelectItem>
                        {accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.toAccountId ? (
                      <p className="text-sm text-destructive">
                        {String(errors.toAccountId.message)}
                      </p>
                    ) : null}
                  </div>
                </div>
              )}

              {/* 5. Categoria/Subcategoria (largura total — apenas transação) */}
              {!isOccurrenceEdit && originType === 'transaction' && (
                <div>
                  <TransactionCategoryField
                    id="recurrence-category"
                    control={form.control}
                    errors={form.formState.errors}
                    isOpen={isCategoryTreeOpen}
                    options={categoryTreeOptions}
                    search={categoryTreeSearch}
                    onSearchChange={(value) => {
                      setCategoryTreeSearch(value)
                      window.requestAnimationFrame(() => {
                        categoryTreeSearchInputRef.current?.focus()
                      })
                    }}
                    contentRef={categoryTreeContentRef}
                    searchInputRef={categoryTreeSearchInputRef}
                    disabled={Boolean(isSubcategoriesError) || isGlobalStructureLocked}
                    disabledMessage={
                      isSubcategoriesError
                        ? 'Erro ao carregar subcategorias da categoria selecionada.'
                        : undefined
                    }
                    allowInlineCreate={false}
                    getCategoryTreeValue={getCategoryTreeValue}
                    onValueChange={handleCategoryTreeSelectValueChange}
                    onOpenChange={handleCategoryTreeOpenChange}
                    onSearchKeyDown={handleCategoryTreeSearchKeyDown}
                    onItemKeyDown={handleCategoryTreeItemKeyDown}
                  />
                  {isSubcategoriesError ? (
                    <div className="mt-2 space-y-1 text-xs text-red-300">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={onSubcategoriesRefetch}
                      >
                        Tentar novamente
                      </Button>
                    </div>
                  ) : null}
                </div>
              )}

              {isEditingActive &&
              isOccurrenceEdit &&
              (occurrenceEditStatus === 'pending_review' ||
                occurrenceEditStatus === 'projected') ? (
                <div className="grid grid-cols-1 gap-3 rounded-xl border bg-muted/20 p-4 lg:grid-cols-12">
                  <div className="min-w-0 lg:col-span-6">
                    <Label htmlFor="recurrence-edit-scope">Aplicar edição em</Label>
                    <Select
                      value={editScope}
                      onValueChange={(value) =>
                        form.setValue(
                          'editScope',
                          value as RecurrenceFormData['editScope'],
                        )
                      }
                    >
                      <SelectTrigger id="recurrence-edit-scope">
                        <SelectValue placeholder="Escopo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single">Somente esta</SelectItem>
                        <SelectItem value="this_and_next">
                          Esta e próximas
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground lg:col-span-12">
                    {editScope === 'this_and_next'
                      ? occurrenceEditStatus === 'projected'
                        ? 'As alterações de valor, descrição e observações serão aplicadas nesta ocorrência projetada e nas próximas a partir da linha selecionada.'
                        : 'As alterações de valor, descrição e observações serão aplicadas nesta ocorrência e nas próximas a partir da linha selecionada.'
                      : occurrenceEditStatus === 'projected'
                        ? 'As alterações de valor, descrição e observações serão aplicadas somente nesta ocorrência projetada.'
                        : 'As alterações de valor, descrição e observações serão aplicadas somente nesta ocorrência.'}
                  </p>
                </div>
              ) : null}

              {formError ? (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
                  <p>{formError}</p>
                  {conflictRecurrenceId ? (
                    <div className="mt-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void onReloadAfterConflict()}
                        disabled={isConflictRefetching}
                      >
                        Recarregar dados da recorrência
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {hasFormErrors ? (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
                  Verifique os campos obrigatórios e tente novamente.
                </div>
              ) : null}
            </div>
          </div>

          <div className="shrink-0 border-t px-4 py-3 sm:px-5">
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitDisabled}>
                {isEditing ? 'Salvar edição' : 'Criar recorrência'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
