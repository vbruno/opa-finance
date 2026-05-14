import { ArrowLeftRight } from 'lucide-react'
import {
  useEffect,
  useRef,
  useState,
} from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ShortcutTooltip } from '@/components/ui/shortcut-hint'
import type { Account } from '@/features/accounts'
import {
  type Transaction,
  useTransferForm,
  useUpdateTransaction,
} from '@/features/transactions'
import { useCreateTransfer } from '@/features/transfers'

import { TransactionAccountField } from './transaction-account-field'
import { TransactionAmountField } from './transaction-amount-field'
import { TransactionDateField } from './transaction-date-field'
import { TransactionRecurrenceConfigModal } from './transaction-recurrence-config-modal'
import { getRecurrenceSummary } from '../model/recurrence-summary'

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
  const [isTransferRecurrenceConfigOpen, setIsTransferRecurrenceConfigOpen] =
    useState(false)
  const transferAmountRef = useRef<HTMLInputElement | null>(null)
  const handledRequestRef = useRef<TransactionsTransferModalRequest | null>(null)

  const createTransferMutation = useCreateTransfer()
  const updateTransactionMutation = useUpdateTransaction()

  const {
    transferForm,
    transferEditContext,
    transferEditError,
    repeatTransferError,
    isTransferRecurrenceEnabled,
    setIsTransferRecurrenceEnabled,
    transferRecurrenceStartDate,
    transferRecurrenceFrequency,
    setTransferRecurrenceFrequency,
    transferRecurrenceEndType,
    setTransferRecurrenceEndType,
    transferRecurrenceEndOccurrences,
    setTransferRecurrenceEndOccurrences,
    transferRecurrenceEndDate,
    setTransferRecurrenceEndDate,
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
            <TransactionAccountField
              id="transfer-from-account"
              label="Conta de origem"
              fieldName="fromAccountId"
              control={transferForm.control}
              errors={transferForm.formState.errors}
              accounts={accounts}
              isOpen={isTransferFromAccountSelectOpen}
              onOpenChange={setIsTransferFromAccountSelectOpen}
            />

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

            <TransactionAccountField
              id="transfer-to-account"
              label="Conta de destino"
              fieldName="toAccountId"
              control={transferForm.control}
              errors={transferForm.formState.errors}
              accounts={accounts}
              isOpen={isTransferToAccountSelectOpen}
              onOpenChange={setIsTransferToAccountSelectOpen}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TransactionDateField
              id="transfer-date"
              register={transferForm.register}
              errors={transferForm.formState.errors}
              isMobile={isMobile}
            />

            <TransactionAmountField
              id="transfer-amount"
              control={transferForm.control}
              errors={transferForm.formState.errors}
              amountRef={transferAmountRef}
              clearAmountError={() => transferForm.clearErrors('amount')}
              setAmountError={(message) => {
                transferForm.setError('amount', { type: 'manual', message })
              }}
              inputMode="numeric"
            />
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
                        setIsTransferRecurrenceConfigOpen(true)
                      } else {
                        setIsTransferRecurrenceConfigOpen(false)
                      }
                    }}
                  />
                  <span>Tornar recorrente</span>
                </label>
                <p className="mt-1 text-xs text-muted-foreground">
                  {isTransferRecurrenceEnabled
                    ? `Configurado: ${getRecurrenceSummary(transferRecurrenceFrequency, transferRecurrenceEndType, transferRecurrenceEndOccurrences, transferRecurrenceEndDate)}`
                    : 'Ative para configurar a regra recorrente desta transferência.'}
                </p>
              </div>
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

        {isOpen && isTransferRecurrenceConfigOpen && (
          <TransactionRecurrenceConfigModal
            startDate={transferRecurrenceStartDate}
            isStartDateReadOnly={true}
            frequency={transferRecurrenceFrequency}
            onFrequencyChange={setTransferRecurrenceFrequency}
            endType={transferRecurrenceEndType}
            onEndTypeChange={setTransferRecurrenceEndType}
            endOccurrences={transferRecurrenceEndOccurrences}
            onEndOccurrencesChange={setTransferRecurrenceEndOccurrences}
            endDate={transferRecurrenceEndDate}
            onEndDateChange={setTransferRecurrenceEndDate}
            onClose={() => {
              setIsTransferRecurrenceConfigOpen(false)
              setIsTransferRecurrenceEnabled(false)
            }}
            onConfirm={() => {
              setIsTransferRecurrenceConfigOpen(false)
            }}
          />
        )}
      </div>
    </div>
  )
}
