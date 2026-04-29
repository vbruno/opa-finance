import { useRef } from 'react'
import { useForm } from 'react-hook-form'
import { describe, expect, it, vi } from 'vitest'

import { TransactionAmountField } from '@/features/transactions/components/transaction-amount-field'
import { fireEvent, renderWithProviders, screen } from '../../../../setup/render'

type SimpleForm = { amount: string }

function AmountFieldHarness({
  clearAmountError = vi.fn(),
  setAmountError,
  defaultAmount = '',
}: {
  clearAmountError?: () => void
  setAmountError?: (message: string) => void
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
      clearAmountError={clearAmountError}
      setAmountError={setAmountError}
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

  it('formata valor monetário ao digitar no campo', () => {
    renderWithProviders(<AmountFieldHarness />)
    const input = screen.getByPlaceholderText('$ 0,00')
    fireEvent.change(input, { target: { value: '100' } })
    expect((input as HTMLInputElement).value).toBe('$ 1,00')
  })

  it('pressionar "=" atualiza valor para "=" e chama clearAmountError', () => {
    const clearAmountError = vi.fn()
    renderWithProviders(<AmountFieldHarness clearAmountError={clearAmountError} />)
    const input = screen.getByPlaceholderText('$ 0,00')
    fireEvent.keyDown(input, { key: '=' })
    expect(clearAmountError).toHaveBeenCalledTimes(1)
    expect((input as HTMLInputElement).value).toBe('=')
  })

  it('calcula expressão válida ao sair do campo', () => {
    renderWithProviders(<AmountFieldHarness />)
    const input = screen.getByPlaceholderText('$ 0,00')
    fireEvent.change(input, { target: { value: '=2+3' } })
    fireEvent.blur(input)
    expect((input as HTMLInputElement).value).toBe('$ 5,00')
  })

  it('sinaliza erro em expressão inválida ao sair do campo', () => {
    const setAmountError = vi.fn()
    renderWithProviders(<AmountFieldHarness setAmountError={setAmountError} />)
    const input = screen.getByPlaceholderText('$ 0,00')
    fireEvent.change(input, { target: { value: '=2+(' } })
    fireEvent.blur(input)
    expect(setAmountError).toHaveBeenCalledWith('Informe uma expressão válida.')
  })

  it('não lança erro ao sair do campo sem expressão', () => {
    renderWithProviders(<AmountFieldHarness />)
    expect(() => fireEvent.blur(screen.getByPlaceholderText('$ 0,00'))).not.toThrow()
  })
})
