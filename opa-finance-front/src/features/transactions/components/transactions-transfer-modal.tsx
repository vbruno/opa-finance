import { ArrowLeftRight } from 'lucide-react'
import type {
  ClipboardEventHandler,
  Dispatch,
  FocusEventHandler,
  FormEventHandler,
  KeyboardEventHandler,
  MouseEventHandler,
  RefObject,
  SetStateAction,
} from 'react'
import { Controller, type UseFormReturn } from 'react-hook-form'

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
import type {
  SetTransactionAmountValue,
  TransferEditContext,
} from '@/features/transactions/model/transactions.types'
import type { TransferCreateFormData } from '@/schemas/transfer.schema'

type TransactionsTransferModalProps = {
  isOpen: boolean
  transferEditContext: TransferEditContext | null
  transferForm: UseFormReturn<TransferCreateFormData>
  accounts: Account[]
  isTransferFromAccountSelectOpen: boolean
  setIsTransferFromAccountSelectOpen: Dispatch<SetStateAction<boolean>>
  isTransferToAccountSelectOpen: boolean
  setIsTransferToAccountSelectOpen: Dispatch<SetStateAction<boolean>>
  isMobile: boolean
  transferAmountRef: RefObject<HTMLInputElement | null>
  onClose: () => void
  onSwapAccounts: () => void
  onSubmit: FormEventHandler<HTMLFormElement>
  onDateFocus: FocusEventHandler<HTMLInputElement>
  onDateClick: MouseEventHandler<HTMLInputElement>
  onDateKeyDown: KeyboardEventHandler<HTMLInputElement>
  onDatePaste: ClipboardEventHandler<HTMLInputElement>
  onTransferAmountChange: (
    rawValue: string,
    onChange: SetTransactionAmountValue,
  ) => void
}

export function TransactionsTransferModal({
  isOpen,
  transferEditContext,
  transferForm,
  accounts,
  isTransferFromAccountSelectOpen,
  setIsTransferFromAccountSelectOpen,
  isTransferToAccountSelectOpen,
  setIsTransferToAccountSelectOpen,
  isMobile,
  transferAmountRef,
  onClose,
  onSwapAccounts,
  onSubmit,
  onDateFocus,
  onDateClick,
  onDateKeyDown,
  onDatePaste,
  onTransferAmountChange,
}: TransactionsTransferModalProps) {
  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="fixed inset-0" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90dvh] overflow-y-auto rounded-lg border bg-background p-4 shadow-lg sm:max-h-none sm:overflow-visible sm:p-6">
        <div>
          <h3 className="text-lg font-semibold">
            {transferEditContext ? 'Editar transferência' : 'Nova transferência'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {transferEditContext
              ? 'Atualize os dados da transferência selecionada.'
              : 'Informe as contas de origem e destino.'}
          </p>
        </div>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="transfer-from-account">Conta de origem</Label>
              <Controller
                control={transferForm.control}
                name="fromAccountId"
                render={({ field }) => (
                  <Select
                    open={isTransferFromAccountSelectOpen}
                    value={field.value ? field.value : '__none__'}
                    onValueChange={(value) =>
                      field.onChange(value === '__none__' ? '' : value)
                    }
                    onOpenChange={setIsTransferFromAccountSelectOpen}
                  >
                    <SelectTrigger
                      id="transfer-from-account"
                      className="h-10"
                      aria-invalid={!!transferForm.formState.errors.fromAccountId}
                    >
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent
                      onEscapeKeyDown={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        setIsTransferFromAccountSelectOpen(false)
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
              {transferForm.formState.errors.fromAccountId && (
                <p className="text-sm text-destructive">
                  {transferForm.formState.errors.fromAccountId.message}
                </p>
              )}
            </div>

            <div className="flex items-center justify-center sm:pb-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 w-9 p-0"
                title="Inverter contas"
                aria-label="Inverter contas"
                onClick={onSwapAccounts}
              >
                <ArrowLeftRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="transfer-to-account">Conta de destino</Label>
              <Controller
                control={transferForm.control}
                name="toAccountId"
                render={({ field }) => (
                  <Select
                    open={isTransferToAccountSelectOpen}
                    value={field.value ? field.value : '__none__'}
                    onValueChange={(value) =>
                      field.onChange(value === '__none__' ? '' : value)
                    }
                    onOpenChange={setIsTransferToAccountSelectOpen}
                  >
                    <SelectTrigger
                      id="transfer-to-account"
                      className="h-10"
                      aria-invalid={!!transferForm.formState.errors.toAccountId}
                    >
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent
                      onEscapeKeyDown={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        setIsTransferToAccountSelectOpen(false)
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
              {transferForm.formState.errors.toAccountId && (
                <p className="text-sm text-destructive">
                  {transferForm.formState.errors.toAccountId.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="transfer-date">Data</Label>
              <Input
                id="transfer-date"
                type="date"
                className="h-10"
                aria-invalid={!!transferForm.formState.errors.date}
                onFocus={onDateFocus}
                inputMode={isMobile ? 'none' : undefined}
                {...transferForm.register('date')}
                onClick={onDateClick}
                onKeyDown={onDateKeyDown}
                onPaste={onDatePaste}
              />
              {transferForm.formState.errors.date && (
                <p className="text-sm text-destructive">
                  {transferForm.formState.errors.date.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="transfer-amount">Valor</Label>
              <Controller
                control={transferForm.control}
                name="amount"
                render={({ field }) => (
                  <Input
                    id="transfer-amount"
                    type="text"
                    inputMode="numeric"
                    placeholder="$ 0,00"
                    className="h-10"
                    ref={transferAmountRef}
                    value={field.value}
                    onChange={(event) => {
                      onTransferAmountChange(event.target.value, field.onChange)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === '=') {
                        event.preventDefault()
                        field.onChange('=')
                        transferForm.clearErrors('amount')
                      }
                    }}
                    aria-invalid={!!transferForm.formState.errors.amount}
                  />
                )}
              />
              {transferForm.formState.errors.amount && (
                <p className="text-sm text-destructive">
                  {transferForm.formState.errors.amount.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="transfer-description">Descrição</Label>
            <Input
              id="transfer-description"
              placeholder="Opcional"
              className="h-10"
              aria-invalid={!!transferForm.formState.errors.description}
              {...transferForm.register('description')}
            />
            {transferForm.formState.errors.description && (
              <p className="text-sm text-destructive">
                {transferForm.formState.errors.description.message}
              </p>
            )}
          </div>

          {transferForm.formState.errors.root && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {transferForm.formState.errors.root.message}
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
                disabled={transferForm.formState.isSubmitting}
              >
                {transferEditContext ? 'Salvar' : 'Transferir'}
              </Button>
            </ShortcutTooltip>
          </div>
        </form>
      </div>
    </div>
  )
}
