import { useForm } from 'react-hook-form'
import { describe, expect, it } from 'vitest'

import { TransactionTypeField } from '@/features/transactions/components/transaction-type-field'
import { renderWithProviders, screen } from '../../../../setup/render'

function TypeFieldHarness({ type }: { type: 'income' | 'expense' | '' }) {
  const form = useForm({ defaultValues: { type: '' } })
  return (
    <TransactionTypeField
      id="test-type"
      register={form.register}
      errors={form.formState.errors}
      type={type}
    />
  )
}

describe('TransactionTypeField', () => {
  it('renderiza label "Tipo" e input readonly', () => {
    renderWithProviders(<TypeFieldHarness type="" />)
    expect(screen.getByText('Tipo')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Receita/Despesa')).toBeInTheDocument()
  })

  it('exibe "Receita" quando type=income', () => {
    renderWithProviders(<TypeFieldHarness type="income" />)
    expect((screen.getByPlaceholderText('Receita/Despesa') as HTMLInputElement).value).toBe('Receita')
  })

  it('exibe "Despesa" quando type=expense', () => {
    renderWithProviders(<TypeFieldHarness type="expense" />)
    expect((screen.getByPlaceholderText('Receita/Despesa') as HTMLInputElement).value).toBe('Despesa')
  })

  it('exibe valor vazio quando type=""', () => {
    renderWithProviders(<TypeFieldHarness type="" />)
    expect((screen.getByPlaceholderText('Receita/Despesa') as HTMLInputElement).value).toBe('')
  })
})
