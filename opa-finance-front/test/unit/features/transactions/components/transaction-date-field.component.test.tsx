import { useRef } from 'react'
import { useForm } from 'react-hook-form'
import { describe, expect, it } from 'vitest'

import { TransactionDateField } from '@/features/transactions/components/transaction-date-field'
import { fireEvent, renderWithProviders, screen } from '../../../../setup/render'

function DateFieldHarness({ isMobile = false }: { isMobile?: boolean }) {
  const form = useForm({ defaultValues: { date: '' } })
  const dateRef = useRef<HTMLInputElement | null>(null)
  return (
    <TransactionDateField
      id="test-date"
      register={form.register}
      errors={form.formState.errors}
      isMobile={isMobile}
      tabIndex={6}
      dateRef={dateRef}
    />
  )
}

describe('TransactionDateField', () => {
  it('renderiza label "Data" e input de data', () => {
    renderWithProviders(<DateFieldHarness />)
    expect(screen.getByText('Data')).toBeInTheDocument()
    expect(screen.getByLabelText('Data')).toBeInTheDocument()
  })

  it('no mobile, previne keydown padrão no campo de data', () => {
    renderWithProviders(<DateFieldHarness isMobile={true} />)
    const input = screen.getByLabelText('Data')
    const notPrevented = fireEvent.keyDown(input, { key: 'a' })
    expect(notPrevented).toBe(false)
  })

  it('fora do mobile, não previne keydown padrão', () => {
    renderWithProviders(<DateFieldHarness isMobile={false} />)
    const input = screen.getByLabelText('Data')
    const notPrevented = fireEvent.keyDown(input, { key: 'a' })
    expect(notPrevented).toBe(true)
  })
})
