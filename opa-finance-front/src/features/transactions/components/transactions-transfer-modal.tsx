import { ArrowLeftRight } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react'
import { Controller } from 'react-hook-form'

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
import { useCreateRecurrence } from '@/features/recurrences'
import {
  type Transaction,
  useDeleteTransaction,
  useTransferForm,
  useUpdateTransaction,
} from '@/features/transactions'
import { useCreateTransfer } from '@/features/transfers'
import { sanitizeExpressionInput } from '@/lib/expression'
import { formatCurrencyInput } from '@/lib/utils'

export type TransactionsTransferModalRequest =
  | { mode: 'create' }
  | { mode: 'repeat'; transaction: Transaction }
  | { mode: 'edit'; transaction: Transaction }

type TransactionsTransferModalProps = {
  isOpen: boolean
  onClose: () => void
  onRequestHandled: () => void
  accounts: Account[]
  primaryAccountId: string
  defaultTransferToAccountId: string
  transactions: Transaction[]
  request: TransactionsTransferModalRequest | null
}

export function TransactionsTransferModal({
  isOpen,
  onClose,
  onRequestHandled,
  accounts,
  primaryAccountId,
  defaultTransferToAccountId,
  transactions,
  request,
}: TransactionsTransferModalProps) {
  const [isMobile, setIsMobile] = useState(false)
  const [isTransferFromAccountSelectOpen, setIsTransferFromAccountSelectOpen] =
    useState(false)
  const [isTransferToAccountSelectOpen, setIsTransferToAccountSelectOpen] =
    useState(false)
  const transferAmountRef = useRef<HTMLInputElement | null>(null)
  const handledRequestRef = useRef<TransactionsTransferModalRequest | null>(null)

  const createTransferMutation = useCreateTransfer()
  const createRecurrenceMutation = useCreateRecurrence()
  const deleteTransactionMutation = useDeleteTransaction()
  const updateTransactionMutation = useUpdateTransaction()

  const {
    transferForm,
    transferEditContext,
    transferEditError,
    repeatTransferError,
    isTransferRecurrenceEnabled,
    setIsTransferRecurrenceEnabled,
    transferRecurrenceStartDate,
    setTransferRecurrenceStartDate,
    setIsTransferRecurrenceStartDateTouched,
    transferRecurrenceFrequency,
    setTransferRecurrenceFrequency,
    transferRecurrenceEndType,
    setTransferRecurrenceEndType,
    transferRecurrenceEndOccurrences,
    setTransferRecurrenceEndOccurrences,
    transferRecurrenceEndDate,
    setTransferRecurrenceEndDate,
    transferRecurrenceDayOfWeek,
    setTransferRecurrenceDayOfWeek,
    transferRecurrenceDayOfMonth,
    setTransferRecurrenceDayOfMonth,
    transferRecurrenceMonthOfYear,
    setTransferRecurrenceMonthOfYear,
    resetTransferRecurrenceDraft,
    handleCloseTransferModal,
    submitTransferForm,
    handleSwapTransferAccounts,
    handleOpenRepeatTransfer,
    handleOpenEditTransfer,
  } = useTransferForm({
    isTransferOpen: isOpen,
    primaryAccountId,
    defaultTransferToAccountId,
    transactions,
    createTransfer: createTransferMutation.mutateAsync,
    createRecurrence: createRecurrenceMutation.mutateAsync,
    deleteTransaction: deleteTransactionMutation.mutateAsync,
    updateTransaction: updateTransactionMutation.mutateAsync,
    onTransferModalOpen: () => {},
    onTransferModalClose: () => {
      setIsTransferFromAccountSelectOpen(false)
      setIsTransferToAccountSelectOpen(false)
      onClose()
    },
    onTransactionDetailsClose: () => {},
  })

  const transferDate = transferForm.watch('date') ?? ''

  useEffect(() => {
    const media = window.matchMedia('(max-width: 639px)')
    const update = () => setIsMobile(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!isOpen) {
      handledRequestRef.current = null
      return
    }

    transferAmountRef.current?.focus()
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !request || handledRequestRef.current === request) {
      return
    }

    handledRequestRef.current = request
    onRequestHandled()

    if (request.mode === 'repeat') {
      void handleOpenRepeatTransfer(request.transaction)
      return
    }

    if (request.mode === 'edit') {
      void handleOpenEditTransfer(request.transaction)
    }
  }, [
    handleOpenEditTransfer,
    handleOpenRepeatTransfer,
    isOpen,
    onRequestHandled,
    request,
  ])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleShortcut = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isTransferToAccountSelectOpen) {
          setIsTransferToAccountSelectOpen(false)
          return
        }
        if (isTransferFromAccountSelectOpen) {
          setIsTransferFromAccountSelectOpen(false)
          return
        }
        handleCloseTransferModal()
        return
      }

      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault()
        void submitTransferForm()
      }
    }

    window.addEventListener('keydown', handleShortcut, true)
    return () => window.removeEventListener('keydown', handleShortcut, true)
  }, [
    handleCloseTransferModal,
    isOpen,
    isTransferFromAccountSelectOpen,
    isTransferToAccountSelectOpen,
    submitTransferForm,
  ])

  const handleDateFocus = useCallback(
    (event: FocusEvent<HTMLInputElement>) => {
      if (!isMobile) {
        return
      }
      const input = event.currentTarget
      if (typeof input.showPicker === 'function') {
        input.showPicker()
      }
    },
    [isMobile],
  )

  const handleDateClick = useCallback(
    (event: MouseEvent<HTMLInputElement>) => {
      const target = event.currentTarget
      if (typeof target.showPicker !== 'function') {
        return
      }
      if (isMobile || event.detail > 0) {
        target.showPicker()
      }
    },
    [isMobile],
  )

  const handleDateKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (isMobile) {
        event.preventDefault()
      }
    },
    [isMobile],
  )

  const handleDatePaste = useCallback(
    (event: ClipboardEvent<HTMLInputElement>) => {
      if (isMobile) {
        event.preventDefault()
      }
    },
    [isMobile],
  )

  const handleTransferAmountChange = useCallback(
    (rawValue: string, onChange: (value: string) => void) => {
      if (rawValue.trimStart().startsWith('=')) {
        onChange(sanitizeExpressionInput(rawValue))
        return
      }
      onChange(formatCurrencyInput(rawValue))
    },
    [],
  )

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="fixed inset-0" onClick={handleCloseTransferModal} />
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

        <form className="mt-6 space-y-4" onSubmit={submitTransferForm}>
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
                onClick={handleSwapTransferAccounts}
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
                onFocus={handleDateFocus}
                inputMode={isMobile ? 'none' : undefined}
                {...transferForm.register('date')}
                onClick={handleDateClick}
                onKeyDown={handleDateKeyDown}
                onPaste={handleDatePaste}
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
                      handleTransferAmountChange(event.target.value, field.onChange)
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

          {!transferEditContext && (
            <>
              <div className="rounded-md border border-border/70 bg-muted/20 p-3">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={isTransferRecurrenceEnabled}
                    onChange={(event) => {
                      const checked = event.target.checked
                      setIsTransferRecurrenceEnabled(checked)
                      if (checked) {
                        resetTransferRecurrenceDraft(transferDate)
                      }
                    }}
                  />
                  <span>Tornar recorrente</span>
                </label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ative para configurar a regra recorrente desta transferência.
                </p>
              </div>

              {isTransferRecurrenceEnabled ? (
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
                          value={transferRecurrenceStartDate}
                          onChange={(event) => {
                            setTransferRecurrenceStartDate(event.target.value)
                            setIsTransferRecurrenceStartDateTouched(true)
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Frequência</Label>
                        <Select
                          value={transferRecurrenceFrequency}
                          onValueChange={(value) =>
                            setTransferRecurrenceFrequency(
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
                      {(transferRecurrenceFrequency === 'weekly' ||
                        transferRecurrenceFrequency === 'biweekly') ? (
                        <div className="space-y-2">
                          <Label>Dia da semana</Label>
                          <Select
                            value={transferRecurrenceDayOfWeek}
                            onValueChange={setTransferRecurrenceDayOfWeek}
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

                      {(transferRecurrenceFrequency === 'monthly' ||
                        transferRecurrenceFrequency === 'yearly') ? (
                        <div className="space-y-2">
                          <Label>Dia do mês</Label>
                          <Input
                            type="number"
                            min={1}
                            max={31}
                            value={transferRecurrenceDayOfMonth}
                            onChange={(event) =>
                              setTransferRecurrenceDayOfMonth(event.target.value)
                            }
                          />
                        </div>
                      ) : null}

                      {transferRecurrenceFrequency === 'yearly' ? (
                        <div className="space-y-2">
                          <Label>Mês</Label>
                          <Input
                            type="number"
                            min={1}
                            max={12}
                            value={transferRecurrenceMonthOfYear}
                            onChange={(event) =>
                              setTransferRecurrenceMonthOfYear(event.target.value)
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
                          value={transferRecurrenceEndType}
                          onValueChange={(value) =>
                            setTransferRecurrenceEndType(
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
                      {transferRecurrenceEndType === 'by_occurrences' ? (
                        <div className="space-y-2">
                          <Label>Qtd. ocorrências</Label>
                          <Input
                            type="number"
                            min={1}
                            value={transferRecurrenceEndOccurrences}
                            onChange={(event) =>
                              setTransferRecurrenceEndOccurrences(event.target.value)
                            }
                          />
                        </div>
                      ) : null}
                      {transferRecurrenceEndType === 'until_date' ? (
                        <div className="space-y-2">
                          <Label>Data final</Label>
                          <Input
                            type="date"
                            value={transferRecurrenceEndDate}
                            onChange={(event) =>
                              setTransferRecurrenceEndDate(event.target.value)
                            }
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          )}

          {(repeatTransferError || transferEditError || transferForm.formState.errors.root) && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {repeatTransferError ??
                transferEditError ??
                transferForm.formState.errors.root?.message}
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <ShortcutTooltip label="Atalho: Esc">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={handleCloseTransferModal}
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
