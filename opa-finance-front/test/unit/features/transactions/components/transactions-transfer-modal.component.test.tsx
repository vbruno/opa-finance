import { useForm } from 'react-hook-form'
import { describe, expect, it, vi } from 'vitest'

import { TransactionsTransferModal } from '@/features/transactions/components/transactions-transfer-modal'
import type { TransferCreateFormData } from '@/schemas/transfer.schema'
import { fireEvent, renderWithProviders, screen } from '../../../../setup/render'

function TransferHarness({
  onClose,
}: {
  onClose: () => void
}) {
  const transferForm = useForm<TransferCreateFormData>({
    defaultValues: {
      fromAccountId: '',
      toAccountId: '',
      amount: '',
      date: '2026-04-13',
      description: '',
    },
  })

  return (
    <TransactionsTransferModal
      isOpen={true}
      transferEditContext={null}
      transferForm={transferForm}
      accounts={[]}
      isTransferFromAccountSelectOpen={false}
      setIsTransferFromAccountSelectOpen={() => {}}
      isTransferToAccountSelectOpen={false}
      setIsTransferToAccountSelectOpen={() => {}}
      isMobile={false}
      transferAmountRef={{ current: null }}
      isTransferRecurrenceEnabled={false}
      setIsTransferRecurrenceEnabled={() => {}}
      transferRecurrenceStartDate="2026-04-13"
      setTransferRecurrenceStartDate={() => {}}
      setIsTransferRecurrenceStartDateTouched={() => {}}
      transferRecurrenceFrequency="monthly"
      setTransferRecurrenceFrequency={() => {}}
      transferRecurrenceEndType="never"
      setTransferRecurrenceEndType={() => {}}
      transferRecurrenceEndOccurrences="12"
      setTransferRecurrenceEndOccurrences={() => {}}
      transferRecurrenceEndDate=""
      setTransferRecurrenceEndDate={() => {}}
      transferRecurrenceDayOfWeek="1"
      setTransferRecurrenceDayOfWeek={() => {}}
      transferRecurrenceDayOfMonth="1"
      setTransferRecurrenceDayOfMonth={() => {}}
      transferRecurrenceMonthOfYear="1"
      setTransferRecurrenceMonthOfYear={() => {}}
      transferDate="2026-04-13"
      resetTransferRecurrenceDraft={() => {}}
      onClose={onClose}
      onSwapAccounts={() => {}}
      onSubmit={(event) => event.preventDefault()}
      onDateFocus={() => {}}
      onDateClick={() => {}}
      onDateKeyDown={() => {}}
      onDatePaste={() => {}}
      onTransferAmountChange={() => {}}
    />
  )
}

describe('TransactionsTransferModal', () => {
  it('deve renderizar e fechar pelo botão cancelar', () => {
    const onClose = vi.fn()
    renderWithProviders(<TransferHarness onClose={onClose} />)

    expect(screen.getByText('Nova transferência')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
