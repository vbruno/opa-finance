import type {
  ClipboardEvent,
  Dispatch,
  FocusEvent,
  FormEventHandler,
  KeyboardEvent,
  MouseEvent,
  PropsWithChildren,
  RefObject,
  SetStateAction,
} from 'react'
import { Controller, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form'

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
import type { SetTransactionAmountValue } from '@/features/transactions/model/transactions.types'
import type { TransactionCreateFormData } from '@/schemas/transaction.schema'

import { TransactionsDescriptionAutocomplete } from './transactions-description-autocomplete'

type CategoryTreeOption = {
  value: string
  label: string
  level: 'category' | 'subcategory'
}

type TransactionsCreateModalProps = PropsWithChildren<{
  isOpen: boolean
  onClose: () => void
}>

type TransactionsCreateModalFormProps = {
  control: Control<TransactionCreateFormData>
  register: UseFormRegister<TransactionCreateFormData>
  errors: FieldErrors<TransactionCreateFormData>
  isSubmitting: boolean
  isMobile: boolean
  accounts: Account[]
  createType: 'income' | 'expense' | ''
  createDescription: string
  createAmount: string
  createNotes: string
  createCategoryName: string
  createSubcategoryName: string
  createAccountName: string
  isCreateAccountSelectOpen: boolean
  setIsCreateAccountSelectOpen: Dispatch<SetStateAction<boolean>>
  isCreateCategoryTreeOpen: boolean
  createCategoryTreeSearch: string
  setCreateCategoryTreeSearch: Dispatch<SetStateAction<string>>
  createCategoryTreeOptions: CategoryTreeOption[]
  createAmountRef: RefObject<HTMLInputElement | null>
  descriptionInputRef: RefObject<HTMLInputElement | null>
  dateInputRef: RefObject<HTMLInputElement | null>
  createCategorySelectRef: RefObject<HTMLButtonElement | null>
  createCategoryTreeSearchInputRef: RefObject<HTMLInputElement | null>
  createCategoryTreeContentRef: RefObject<HTMLDivElement | null>
  descriptionSuggestions: string[]
  areDescriptionSuggestionsLoading: boolean
  hasDescriptionSuggestionsError: boolean
  shouldFilterSuggestions: boolean
  isDescriptionSuggestionsOpen: boolean
  setIsDescriptionSuggestionsOpen: Dispatch<SetStateAction<boolean>>
  isDescriptionFocused: boolean
  setIsDescriptionFocused: Dispatch<SetStateAction<boolean>>
  activeSuggestionIndex: number
  setActiveSuggestionIndex: Dispatch<SetStateAction<number>>
  isCreateRecurrenceEnabled: boolean
  setIsCreateRecurrenceEnabled: Dispatch<SetStateAction<boolean>>
  createDate: string
  createRecurrenceStartDate: string
  setCreateRecurrenceStartDate: Dispatch<SetStateAction<string>>
  setIsCreateRecurrenceStartDateTouched: Dispatch<SetStateAction<boolean>>
  createRecurrenceFrequency: 'weekly' | 'biweekly' | 'monthly' | 'yearly'
  setCreateRecurrenceFrequency: Dispatch<
    SetStateAction<'weekly' | 'biweekly' | 'monthly' | 'yearly'>
  >
  createRecurrenceEndType: 'never' | 'by_occurrences' | 'until_date'
  setCreateRecurrenceEndType: Dispatch<
    SetStateAction<'never' | 'by_occurrences' | 'until_date'>
  >
  createRecurrenceEndOccurrences: string
  setCreateRecurrenceEndOccurrences: Dispatch<SetStateAction<string>>
  createRecurrenceEndDate: string
  setCreateRecurrenceEndDate: Dispatch<SetStateAction<string>>
  createRecurrenceDayOfWeek: string
  setCreateRecurrenceDayOfWeek: Dispatch<SetStateAction<string>>
  createRecurrenceDayOfMonth: string
  setCreateRecurrenceDayOfMonth: Dispatch<SetStateAction<string>>
  createRecurrenceMonthOfYear: string
  setCreateRecurrenceMonthOfYear: Dispatch<SetStateAction<string>>
  onSubmit: FormEventHandler<HTMLFormElement>
  onClear: () => void
  onClose: () => void
  onDateFocus: (event: FocusEvent<HTMLInputElement>) => void
  onDateClick: (event: MouseEvent<HTMLInputElement>) => void
  onDateKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
  onDatePaste: (event: ClipboardEvent<HTMLInputElement>) => void
  onTransactionAmountChange: (
    rawValue: string,
    onChange: SetTransactionAmountValue,
  ) => void
  onCreateAmountBlur: (
    value: string,
    onChange: SetTransactionAmountValue,
  ) => void
  onCreateAmountShortcut: () => void
  getCreateCategoryTreeValue: () => string
  handleCreateCategoryTreeSelectValueChange: (
    value: string,
    onChange: (value: string) => void,
  ) => void
  handleCreateCategoryTreeOpenChange: (open: boolean) => void
  handleCreateCategoryTreeSearchKeyDown: (
    event: KeyboardEvent<HTMLInputElement>,
  ) => void
  handleCreateCategoryTreeItemKeyDown: (
    event: KeyboardEvent<HTMLDivElement>,
  ) => void
  createCategoryTreeNoneValue: string
  createCategoryTreeCreateCategoryValue: string
  createCategoryTreeCreateSubcategoryValue: string
  resetCreateRecurrenceDraft: (dateValue: string) => void
  setValue: (
    name: keyof TransactionCreateFormData,
    value: string,
    options?: { shouldDirty?: boolean; shouldTouch?: boolean },
  ) => void
}

export function TransactionsCreateModal({
  isOpen,
  onClose,
  children,
}: TransactionsCreateModalProps) {
  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="fixed inset-0" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90dvh] overflow-y-auto overscroll-contain rounded-lg border bg-background p-4 shadow-lg sm:p-6">
        <div>
          <h3 className="text-lg font-semibold">Nova transação</h3>
          <p className="text-sm text-muted-foreground">
            Preencha os dados para registrar uma nova transação.
          </p>
        </div>
        {children}
      </div>
    </div>
  )
}

export function TransactionsCreateModalForm({
  control,
  register,
  errors,
  isSubmitting,
  isMobile,
  accounts,
  createType,
  createDescription,
  createAmount,
  createNotes,
  createCategoryName,
  createSubcategoryName,
  createAccountName,
  isCreateAccountSelectOpen,
  setIsCreateAccountSelectOpen,
  isCreateCategoryTreeOpen,
  createCategoryTreeSearch,
  setCreateCategoryTreeSearch,
  createCategoryTreeOptions,
  createAmountRef,
  descriptionInputRef,
  dateInputRef,
  createCategorySelectRef,
  createCategoryTreeSearchInputRef,
  createCategoryTreeContentRef,
  descriptionSuggestions,
  areDescriptionSuggestionsLoading,
  hasDescriptionSuggestionsError,
  shouldFilterSuggestions,
  isDescriptionSuggestionsOpen,
  setIsDescriptionSuggestionsOpen,
  isDescriptionFocused,
  setIsDescriptionFocused,
  activeSuggestionIndex,
  setActiveSuggestionIndex,
  isCreateRecurrenceEnabled,
  setIsCreateRecurrenceEnabled,
  createDate,
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
  onSubmit,
  onClear,
  onClose,
  onDateFocus,
  onDateClick,
  onDateKeyDown,
  onDatePaste,
  onTransactionAmountChange,
  onCreateAmountBlur,
  onCreateAmountShortcut,
  getCreateCategoryTreeValue,
  handleCreateCategoryTreeSelectValueChange,
  handleCreateCategoryTreeOpenChange,
  handleCreateCategoryTreeSearchKeyDown,
  handleCreateCategoryTreeItemKeyDown,
  createCategoryTreeNoneValue,
  createCategoryTreeCreateCategoryValue,
  createCategoryTreeCreateSubcategoryValue,
  resetCreateRecurrenceDraft,
  setValue,
}: TransactionsCreateModalFormProps) {
  return (
    <form className="mt-6 space-y-4 pb-10 sm:pb-0" onSubmit={onSubmit}>
      <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-2'}`}>
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
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.accountId && (
            <p className="text-sm text-destructive">{errors.accountId.message}</p>
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
                onFocus={onDateFocus}
                inputMode={isMobile ? 'none' : undefined}
                tabIndex={6}
                {...dateRegister}
                ref={(element) => {
                  dateRegister.ref(element)
                  dateInputRef.current = element
                }}
                onClick={onDateClick}
                onKeyDown={onDateKeyDown}
                onPaste={onDatePaste}
              />
            )
          })()}
          {errors.date && (
            <p className="text-sm text-destructive">{errors.date.message}</p>
          )}
        </div>
      </div>

      <div className="grid gap-4">
        <div className="space-y-2">
          <Label htmlFor="transaction-category">Categoria/Subcategoria</Label>
          <Controller
            control={control}
            name="categoryId"
            render={({ field }) => (
              <Select
                open={isCreateCategoryTreeOpen}
                value={getCreateCategoryTreeValue()}
                onValueChange={(value) =>
                  handleCreateCategoryTreeSelectValueChange(value, field.onChange)
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
                    handleCreateCategoryTreeOpenChange(false)
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
                    value={createCategoryTreeNoneValue}
                    className="hidden"
                    textValue="none"
                  >
                    Selecione
                  </SelectItem>
                  <SelectItem
                    value={createCategoryTreeCreateCategoryValue}
                    onKeyDown={handleCreateCategoryTreeItemKeyDown}
                    textValue="create-category"
                  >
                    + Nova categoria
                  </SelectItem>
                  <SelectItem
                    value={createCategoryTreeCreateSubcategoryValue}
                    onKeyDown={handleCreateCategoryTreeItemKeyDown}
                    textValue="create-subcategory"
                  >
                    + Nova subcategoria
                  </SelectItem>
                  {createCategoryTreeOptions.map((option, optionIndex) => (
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
                  ))}
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
            <p className="text-sm text-destructive">{errors.categoryId.message}</p>
          )}
        </div>
      </div>

      <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-2'}`}>
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
            <p className="text-sm text-destructive">{errors.type.message}</p>
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
                  onTransactionAmountChange(event.target.value, field.onChange)
                }}
                onKeyDown={(event) => {
                  if (event.key === '=') {
                    event.preventDefault()
                    field.onChange('=')
                    onCreateAmountShortcut()
                  }
                }}
                onBlur={() => {
                  onCreateAmountBlur(field.value, field.onChange)
                  field.onBlur()
                }}
                aria-invalid={!!errors.amount}
                tabIndex={3}
              />
            )}
          />
          {errors.amount && (
            <p className="text-sm text-destructive">{errors.amount.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="transaction-description">Descrição</Label>
        {(() => {
          const descriptionRegister = register('description')
          return (
            <TransactionsDescriptionAutocomplete
              descriptionRegister={descriptionRegister}
              descriptionInputRef={descriptionInputRef}
              isInvalid={!!errors.description}
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
              setValue={setValue}
            />
          )
        })()}
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
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
          <p className="text-sm text-destructive">{errors.notes.message}</p>
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
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Base da transação
            </p>
            <div className="grid gap-1.5 sm:gap-2 md:grid-cols-2">
              <p>
                <strong className="text-foreground">Conta:</strong>{' '}
                {createAccountName || 'Selecione'}
              </p>
              <p>
                <strong className="text-foreground">Categoria:</strong>{' '}
                {createCategoryName || 'Selecione'}
              </p>
              <p>
                <strong className="text-foreground">Subcategoria:</strong>{' '}
                {createSubcategoryName || 'Nenhuma'}
              </p>
              <p>
                <strong className="text-foreground">Valor:</strong>{' '}
                {createAmount || '-'}
              </p>
              <p>
                <strong className="text-foreground">Descrição:</strong>{' '}
                {createDescription || '-'}
              </p>
              <p>
                <strong className="text-foreground">Notas:</strong>{' '}
                {createNotes.trim() || '-'}
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
            onClick={onClear}
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
  )
}
