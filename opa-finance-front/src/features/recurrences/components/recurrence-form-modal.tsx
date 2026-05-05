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
import { getTodayIsoDateInTimezone } from '@/features/recurrences/model/recurrences.helpers'
import { useCategoryTreeInteraction } from '@/features/transactions/hooks/use-category-tree-interaction'
import { buildCategoryTreeOptions } from '@/features/transactions/model/transactions-page.helpers'
import { type RecurrenceFormData } from '@/schemas/recurrence.schema'

import { TransactionAccountField } from '../../transactions/components/transaction-account-field'
import { TransactionAmountField } from '../../transactions/components/transaction-amount-field'
import { TransactionCategoryField } from '../../transactions/components/transaction-category-field'
import { TransactionDateField } from '../../transactions/components/transaction-date-field'
import { TransactionDescriptionField } from '../../transactions/components/transaction-description-field'
import { TransactionNotesField } from '../../transactions/components/transaction-notes-field'

function getIsoDateDayOfWeekValue(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return ''
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return ''

  const date = new Date(Date.UTC(year, month - 1, day))
  if (Number.isNaN(date.getTime())) return ''

  return String(date.getUTCDay())
}

type RecurrenceFormModalProps = {
  open: boolean
  isEditing: boolean
  isSingleScopeEdit: boolean
  isAnyMutationPending: boolean
  isFormSupportDataLoading: boolean
  isSubcategoriesError: boolean
  formError: string | null
  conflictRecurrenceId: string | null
  isConflictRefetching: boolean
  editingRecurrence: Recurrence | null
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
  isSingleScopeEdit,
  isAnyMutationPending,
  isFormSupportDataLoading,
  isSubcategoriesError,
  formError,
  conflictRecurrenceId,
  isConflictRefetching,
  editingRecurrence,
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

  const isEditingActive = isEditing && editingRecurrence?.status === 'active'
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

    const nextDayOfWeek = getIsoDateDayOfWeekValue(startDate)
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
            {isEditing ? 'Editar recorrência' : 'Nova recorrência'}
          </h2>
        </div>

        <form className="flex flex-1 min-h-0 flex-col" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 sm:px-5">
            <div className="space-y-4">
              {/* 1. Modo de lançamento | Origem | Frequência */}
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
                    disabled={isSingleScopeEdit}
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
                    disabled={isEditing}
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
                        const nextDayOfWeek = getIsoDateDayOfWeekValue(
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
                    disabled={isSingleScopeEdit}
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

              {/* 2. Data inicial | Dia do mês/semana [| Mês] */}
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
                    disabled={isSingleScopeEdit}
                  />
                </div>

                {isWeeklyFrequency && (
                  <div className="min-w-0">
                    <Label htmlFor="recurrence-day-of-week">Dia da semana</Label>
                    <Select
                      value={dayOfWeek || '__none__'}
                      onValueChange={(value) =>
                        form.setValue(
                          'dayOfWeek',
                          value === '__none__' ? '' : value,
                        )
                      }
                      disabled={isSingleScopeEdit}
                    >
                      <SelectTrigger id="recurrence-day-of-week">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Selecione</SelectItem>
                        {RECURRENCE_DAY_OF_WEEK_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                      disabled={isSingleScopeEdit}
                    />
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
                      disabled={isSingleScopeEdit}
                    >
                      <SelectTrigger id="recurrence-month-of-year">
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
                  </div>
                )}
              </div>

              {/* 3. Término | Data final / Qtd. ocorrências */}
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
                <div className="min-w-0">
                  <Label htmlFor="recurrence-end-type">Término</Label>
                  <Select
                    value={endType}
                    onValueChange={(value) =>
                      form.setValue(
                        'endType',
                        value as RecurrenceFormData['endType'],
                      )
                    }
                    disabled={isSingleScopeEdit}
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
                    <Label>Qtd. ocorrências</Label>
                    <Input
                      type="number"
                      min={1}
                      className="h-10"
                      {...form.register('endOccurrences')}
                      disabled={isSingleScopeEdit}
                    />
                  </div>
                )}

                {endType === 'until_date' && (
                  <div className="min-w-0">
                    <Label>Data final</Label>
                    <Input
                      type="date"
                      className="h-10"
                      {...form.register('endDate')}
                      disabled={isSingleScopeEdit}
                    />
                  </div>
                )}
              </div>

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
              {originType === 'transaction' ? (
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
                    >
                      <SelectTrigger>
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
                    >
                      <SelectTrigger>
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
                  </div>
                </div>
              )}

              {/* 5. Categoria/Subcategoria (largura total — apenas transação) */}
              {originType === 'transaction' && (
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
                    disabled={Boolean(isSubcategoriesError)}
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

              {isEditingActive ? (
                <div className="grid grid-cols-1 gap-3 rounded-xl border bg-muted/20 p-4 lg:grid-cols-12">
                  <div className="min-w-0 lg:col-span-6">
                    <Label>Aplicar edição em</Label>
                    <Select
                      value={editScope}
                      onValueChange={(value) =>
                        form.setValue(
                          'editScope',
                          value as RecurrenceFormData['editScope'],
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Escopo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        <SelectItem value="this_and_next">
                          Esta e próximas
                        </SelectItem>
                        <SelectItem value="single">Somente esta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {editScope !== 'all' ? (
                    <div className="min-w-0 lg:col-span-6">
                      <Label>Data da ocorrência</Label>
                      <Input
                        type="date"
                        min={
                          editScope === 'single'
                            ? getTodayIsoDateInTimezone(
                                editingRecurrence?.timezone,
                              )
                            : undefined
                        }
                        {...form.register('occurrenceDate')}
                      />
                      {editScope === 'single' ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Para ocorrência passada já materializada, faça ajuste
                          manual em Transações.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
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
