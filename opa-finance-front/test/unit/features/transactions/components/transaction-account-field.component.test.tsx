import { useForm } from 'react-hook-form'
import { describe, expect, it, vi } from 'vitest'

import { TransactionAccountField } from '@/features/transactions/components/transaction-account-field'
import { renderWithProviders, screen } from '../../../../setup/render'

const mockAccounts = [
  {
    id: 'acc-1',
    name: 'Conta Corrente',
    type: 'checking',
    currentBalance: 0,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'acc-2',
    name: 'Poupança',
    type: 'savings',
    currentBalance: 0,
    createdAt: '',
    updatedAt: '',
  },
]

function AccountFieldHarness({
  label = 'Conta',
  fieldName,
}: {
  label?: string
  fieldName?: string
}) {
  const form = useForm({
    defaultValues: { accountId: '', fromAccountId: '', toAccountId: '' },
  })
  return (
    <TransactionAccountField
      id="test-account"
      label={label}
      fieldName={fieldName}
      control={form.control}
      errors={form.formState.errors}
      accounts={mockAccounts}
      isOpen={false}
      onOpenChange={vi.fn()}
      tabIndex={7}
    />
  )
}

describe('TransactionAccountField', () => {
  it('renderiza a label passada via prop', () => {
    renderWithProviders(<AccountFieldHarness label="Conta" />)
    expect(screen.getByText('Conta')).toBeInTheDocument()
  })

  it('renderiza label personalizada para conta de origem', () => {
    renderWithProviders(
      <AccountFieldHarness label="Conta de origem" fieldName="fromAccountId" />,
    )
    expect(screen.getByText('Conta de origem')).toBeInTheDocument()
  })

  it('renderiza label personalizada para conta de destino', () => {
    renderWithProviders(
      <AccountFieldHarness label="Conta de destino" fieldName="toAccountId" />,
    )
    expect(screen.getByText('Conta de destino')).toBeInTheDocument()
  })

  it('renderiza o select acessível pelo label', () => {
    renderWithProviders(<AccountFieldHarness label="Conta" />)
    expect(screen.getByRole('combobox', { name: /Conta/i })).toBeInTheDocument()
  })
})
