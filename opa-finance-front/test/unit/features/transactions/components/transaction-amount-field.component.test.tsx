import { useRef } from 'react'
import { useForm } from 'react-hook-form'
import { describe, expect, it, vi } from 'vitest'

import { TransactionAmountField } from '@/features/transactions/components/transaction-amount-field'
import { fireEvent, renderWithProviders, screen } from '../../../../setup/render'

type SimpleForm = { amount: string }

function AmountFieldHarness({
  onAmountChange = (_rawValue: string, onChange: (v: string) => void) => onChange(_rawValue),
  clearAmountError = vi.fn(),
  onAmountBlur,
  defaultAmount = '',
}: {
  onAmountChange?: (rawValue: string, onChange: (value: string) => void) => void
  clearAmountError?: () => void
  onAmountBlur?: (value: string, onChange: (value: string) => void) => void
  defaultAmount?: string
}) {
  const form = useForm<SimpleForm>({ defaultValues: { amount: defaultAmount } })
  const amountRef = useRef<HTMLInputElement | null>(null)

  return (
    <TransactionAmountField
      id="test-amount"
      control={form.control}
      errors={form.formState.errors}
      amountRef={amountRef}
      onAmountChange={onAmountChange}
      clearAmountError={clearAmountError}
      onAmountBlur={onAmountBlur}
      tabIndex={1}
    />
  )
}

describe('TransactionAmountField', () => {
  it('renderiza label "Valor" e input com placeholder correto', () => {
    renderWithProviders(<AmountFieldHarness />)
    expect(screen.getByText('Valor')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('$ 0,00')).toBeInTheDocument()
  })

  it('chama onAmountChange ao digitar no campo', () => {
    const onAmountChange = vi.fn((_raw: string, onChange: (v: string) => void) => onChange(_raw))
    renderWithProviders(<AmountFieldHarness onAmountChange={onAmountChange} />)
    const input = screen.getByPlaceholderText('$ 0,00')
    fireEvent.change(input, { target: { value: '100' } })
    expect(onAmountChange).toHaveBeenCalledWith('100', expect.any(Function))
  })

  it('pressionar "=" atualiza valor para "=" e chama clearAmountError', () => {
    const clearAmountError = vi.fn()
    renderWithProviders(<AmountFieldHarness clearAmountError={clearAmountError} />)
    const input = screen.getByPlaceholderText('$ 0,00')
    fireEvent.keyDown(input, { key: '=' })
    expect(clearAmountError).toHaveBeenCalledTimes(1)
    expect((input as HTMLInputElement).value).toBe('=')
  })

  it('chama onAmountBlur ao sair do campo quando fornecido', () => {
    const onAmountBlur = vi.fn()
    renderWithProviders(<AmountFieldHarness onAmountBlur={onAmountBlur} />)
    fireEvent.blur(screen.getByPlaceholderText('$ 0,00'))
    expect(onAmountBlur).toHaveBeenCalledTimes(1)
  })

  it('não lança erro ao sair do campo quando onAmountBlur não é fornecido', () => {
    renderWithProviders(<AmountFieldHarness />)
    expect(() => fireEvent.blur(screen.getByPlaceholderText('$ 0,00'))).not.toThrow()
  })
})
