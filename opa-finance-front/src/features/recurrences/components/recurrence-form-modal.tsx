import { useMemo, useRef, useState } from 'react'
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
import { TransactionTypeField } from '../../transactions/components/transaction-type-field'

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
  subcategories: Subcategory[]
  selectedCategoryType: Category['type'] | null
  originType: RecurrenceFormData['originType']
  frequency: RecurrenceFormData['frequency']
  endType: RecurrenceFormData['endType']
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
  subcategories,
  selectedCategoryType,
  originType,
  frequency,
  endType,
  editScope,
  form,
  onClose,
  onSubmit,
  onReloadAfterConflict,
  onSubcategoriesRefetch,
}: RecurrenceFormModalProps) {
  const selectedCategoryId = form.watch('categoryId')
  const postingMode = form.watch('postingMode')
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
  const selectedTransactionType: 'income' | 'expense' | '' =
    selectedCategoryType === 'income' || selectedCategoryType === 'expense'
      ? selectedCategoryType
      : ''

  const categoryTreeOptions = useMemo(
    () =>
      buildCategoryTreeOptions({
        categories,
        subcategoriesByCategory: selectedCategoryId
          ? { [selectedCategoryId]: subcategories }
          : {},
        search: categoryTreeSearch,
      }),
    [categories, categoryTreeSearch, selectedCategoryId, subcategories],
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

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-xl border bg-background p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4">
          <h2 className="text-lg font-semibold">
            {isEditing ? 'Editar recorrência' : 'Nova recorrência'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isEditing
              ? 'Atualize os dados da regra e escolha o escopo da edição.'
              : 'Configure a regra para geração automática de lançamentos.'}
          </p>
        </div>

        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div>
              <Label>Origem</Label>
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
                <SelectTrigger>
                  <SelectValue placeholder="Origem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transaction">Transação</SelectItem>
                  <SelectItem value="transfer">Transferência</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Frequência</Label>
              <Select
                value={frequency}
                onValueChange={(value) =>
                  form.setValue(
                    'frequency',
                    value as RecurrenceFormData['frequency'],
                  )
                }
                disabled={isSingleScopeEdit}
              >
                <SelectTrigger>
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

            <div>
              <Label>Modo de lançamento</Label>
              <Select
                value={postingMode}
                onValueChange={(value) =>
                  form.setValue(
                    'postingMode',
                    value as RecurrenceFormData['postingMode'],
                  )
                }
                disabled={isSingleScopeEdit}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Modo" />
                </SelectTrigger>
                <SelectContent>
                  {RECURRENCE_POSTING_MODES.map((mode) => (
                    <SelectItem key={mode} value={mode}>
                      {RECURRENCE_POSTING_MODE_LABELS[mode]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
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

          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <TransactionDateField
              id="recurrence-start-date"
              label="Data inicial"
              fieldName="startDate"
              register={form.register}
              errors={form.formState.errors}
              isMobile={false}
              disabled={isSingleScopeEdit}
            />

            {(frequency === 'weekly' || frequency === 'biweekly') && (
              <div>
                <Label>Dia da semana</Label>
                <Select
                  value={form.watch('dayOfWeek') || '__none__'}
                  onValueChange={(value) =>
                    form.setValue(
                      'dayOfWeek',
                      value === '__none__' ? '' : value,
                    )
                  }
                  disabled={isSingleScopeEdit}
                >
                  <SelectTrigger>
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
              <div>
                <Label>Dia do mês</Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  {...form.register('dayOfMonth')}
                  disabled={isSingleScopeEdit}
                />
              </div>
            )}

            {frequency === 'yearly' && (
              <div>
                <Label>Mês</Label>
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
                  <SelectTrigger>
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

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <Label>Término</Label>
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
                <SelectTrigger>
                  <SelectValue placeholder="Término" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="never">Sem fim</SelectItem>
                  <SelectItem value="by_occurrences">
                    Por ocorrências
                  </SelectItem>
                  <SelectItem value="until_date">Por data final</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {endType === 'by_occurrences' && (
              <div>
                <Label>Qtd. ocorrências</Label>
                <Input
                  type="number"
                  min={1}
                  {...form.register('endOccurrences')}
                  disabled={isSingleScopeEdit}
                />
              </div>
            )}

            {endType === 'until_date' && (
              <div>
                <Label>Data final</Label>
                <Input
                  type="date"
                  {...form.register('endDate')}
                  disabled={isSingleScopeEdit}
                />
              </div>
            )}
          </div>

          {originType === 'transaction' ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <TransactionAccountField
                id="recurrence-account"
                label="Conta"
                control={form.control}
                errors={form.formState.errors}
                accounts={accounts}
                isOpen={isAccountSelectOpen}
                onOpenChange={setIsAccountSelectOpen}
              />

              <TransactionTypeField
                id="recurrence-transaction-type"
                label="Tipo (derivado da categoria)"
                errors={form.formState.errors}
                type={selectedTransactionType}
              />

              <div className="md:col-span-2">
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
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
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
              <div>
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

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <TransactionDescriptionField
              id="recurrence-description"
              register={form.register}
              errors={form.formState.errors}
              descriptionInputRef={descriptionInputRef}
              setValue={form.setValue}
              descriptionSuggestions={[]}
              areDescriptionSuggestionsLoading={false}
              hasDescriptionSuggestionsError={false}
              shouldFilterSuggestions={false}
              isDescriptionSuggestionsOpen={isDescriptionSuggestionsOpen}
              setIsDescriptionSuggestionsOpen={setIsDescriptionSuggestionsOpen}
              isDescriptionFocused={isDescriptionFocused}
              setIsDescriptionFocused={setIsDescriptionFocused}
              activeSuggestionIndex={activeSuggestionIndex}
              setActiveSuggestionIndex={setActiveSuggestionIndex}
              enableSuggestions={false}
            />
            <TransactionNotesField
              id="recurrence-notes"
              label="Observações"
              register={form.register}
              errors={form.formState.errors}
            />
          </div>

          {isEditing && editingRecurrence?.status === 'active' ? (
            <div className="grid grid-cols-1 gap-3 rounded-md border p-3 md:grid-cols-2">
              <div>
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
                <div>
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
            <div className="rounded-md border border-red-500/40 bg-red-500/10 p-2 text-sm text-red-300">
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

          {Object.keys(form.formState.errors).length > 0 ? (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 p-2 text-sm text-red-300">
              Verifique os campos obrigatórios e tente novamente.
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={
                isAnyMutationPending ||
                isFormSupportDataLoading ||
                Boolean(isSubcategoriesError)
              }
            >
              {isEditing ? 'Salvar edição' : 'Criar recorrência'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
