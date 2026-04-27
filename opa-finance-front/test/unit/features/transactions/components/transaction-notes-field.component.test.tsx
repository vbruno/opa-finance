import { useForm } from 'react-hook-form'
import { describe, expect, it } from 'vitest'

import { TransactionNotesField } from '@/features/transactions/components/transaction-notes-field'
import { renderWithProviders, screen } from '../../../../setup/render'

function NotesFieldHarness() {
  const form = useForm({ defaultValues: { notes: '' } })
  return (
    <TransactionNotesField
      id="test-notes"
      register={form.register}
      errors={form.formState.errors}
      tabIndex={2}
    />
  )
}

describe('TransactionNotesField', () => {
  it('renderiza label "Notas" e input com placeholder "Opcional"', () => {
    renderWithProviders(<NotesFieldHarness />)
    expect(screen.getByText('Notas')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Opcional')).toBeInTheDocument()
  })
})
