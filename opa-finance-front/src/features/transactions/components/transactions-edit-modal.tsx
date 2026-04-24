import type {
  ClipboardEvent,
  Dispatch,
  FocusEvent,
  FormEventHandler,
  KeyboardEvent,
  MouseEvent,
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
import type { Transaction } from '@/features/transactions/transactions.api'
import type { TransactionCreateFormData } from '@/schemas/transaction.schema'

type CategoryTreeOption = {
  value: string
  label: string
  level: 'category' | 'subcategory'
}

type TransactionsEditModalProps = {
  isOpen: boolean
  selectedTransaction: Transaction | null
  editControl: Control<TransactionCreateFormData>
  editRegister: UseFormRegister<TransactionCreateFormData>
  editErrors: FieldErrors<TransactionCreateFormData>
  clearEditErrors: (name?: keyof TransactionCreateFormData) => void
  editType: 'income' | 'expense' | ''
  isMobile: boolean
  accounts: Account[]
  isEditSubmitting: boolean
  isEditAccountSelectOpen: boolean
  setIsEditAccountSelectOpen: Dispatch<SetStateAction<boolean>>
  isEditCategoryTreeOpen: boolean
  editCategoryTreeSearch: string
  setEditCategoryTreeSearch: Dispatch<SetStateAction<string>>
  editCategoryTreeOptions: CategoryTreeOption[]
  editCategoryTreeContentRef: RefObject<HTMLDivElement | null>
  editCategoryTreeSearchInputRef: RefObject<HTMLInputElement | null>
  editAmountRef: RefObject<HTMLInputElement | null>
  getEditCategoryTreeValue: () => string
  handleEditCategoryTreeValueChange: (
    value: string,
    onChange: (value: string) => void,
  ) => void
  handleEditCategoryTreeOpenChange: (open: boolean) => void
  handleEditCategoryTreeSearchKeyDown: (
    event: KeyboardEvent<HTMLInputElement>,
  ) => void
  handleEditCategoryTreeItemKeyDown: (
    event: KeyboardEvent<HTMLDivElement>,
  ) => void
  handleTransactionAmountChange: (
    rawValue: string,
    onChange: SetTransactionAmountValue,
  ) => void
  onSubmit: FormEventHandler<HTMLFormElement>
  onClose: () => void
  onDateFocus: (event: FocusEvent<HTMLInputElement>) => void
  onDateClick: (event: MouseEvent<HTMLInputElement>) => void
  onDateKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
  onDatePaste: (event: ClipboardEvent<HTMLInputElement>) => void
  createCategoryTreeNoneValue: string
  createCategoryTreeCreateCategoryValue: string
  createCategoryTreeCreateSubcategoryValue: string
}

export function TransactionsEditModal({
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
}: TransactionsEditModalProps) {
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
                onFocus={onDateFocus}
                inputMode={isMobile ? 'none' : undefined}
                tabIndex={6}
                {...editRegister('date')}
                onClick={onDateClick}
                onKeyDown={onDateKeyDown}
                onPaste={onDatePaste}
              />
              {editErrors.date && (
                <p className="text-sm text-destructive">{editErrors.date.message}</p>
              )}
            </div>
          </div>

          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="transaction-edit-category">
                Categoria/Subcategoria
              </Label>
              <Controller
                control={editControl}
                name="categoryId"
                render={({ field }) => (
                  <Select
                    open={isEditCategoryTreeOpen}
                    disabled={isTransferTransaction}
                    value={getEditCategoryTreeValue()}
                    onValueChange={(value) =>
                      handleEditCategoryTreeValueChange(value, field.onChange)
                    }
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
                      <SelectItem
                        value={createCategoryTreeNoneValue}
                        className="hidden"
                        textValue="none"
                      >
                        Selecione
                      </SelectItem>
                      <SelectItem
                        value={createCategoryTreeCreateCategoryValue}
                        onKeyDown={handleEditCategoryTreeItemKeyDown}
                        textValue="create-category"
                      >
                        + Nova categoria
                      </SelectItem>
                      <SelectItem
                        value={createCategoryTreeCreateSubcategoryValue}
                        onKeyDown={handleEditCategoryTreeItemKeyDown}
                        textValue="create-subcategory"
                      >
                        + Nova subcategoria
                      </SelectItem>
                      {editCategoryTreeOptions.map((option, optionIndex) => (
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
              {editErrors.categoryId && (
                <p className="text-sm text-destructive">
                  {editErrors.categoryId.message}
                </p>
              )}
              {editErrors.subcategoryId && (
                <p className="text-sm text-destructive">
                  {editErrors.subcategoryId.message}
                </p>
              )}
              {isTransferTransaction && (
                <p className="text-xs text-muted-foreground">
                  Categoria e subcategoria de transferências não podem ser
                  alteradas.
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
                <p className="text-sm text-destructive">{editErrors.type.message}</p>
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
                        clearEditErrors('amount')
                      }
                    }}
                    aria-invalid={!!editErrors.amount}
                    tabIndex={3}
                  />
                )}
              />
              {editErrors.amount && (
                <p className="text-sm text-destructive">{editErrors.amount.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="transaction-edit-description">Descrição</Label>
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
              <p className="text-sm text-destructive">{editErrors.notes.message}</p>
            )}
          </div>

          {editErrors.root && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {editErrors.root.message}
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <ShortcutTooltip label="Atalho: Esc">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={onClose}
              >
                Cancelar
              </Button>
            </ShortcutTooltip>
            <ShortcutTooltip label="Atalho: Ctrl/Cmd+Enter">
              <Button
                type="submit"
                className="w-full sm:w-auto"
                disabled={isEditSubmitting}
              >
                Atualizar
              </Button>
            </ShortcutTooltip>
          </div>
        </form>
      </div>
    </div>
  )
}
