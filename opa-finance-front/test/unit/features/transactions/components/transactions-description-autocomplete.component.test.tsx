import { useRef, useState, type FormEvent } from 'react'
import { useForm } from 'react-hook-form'
import { describe, expect, it, vi } from 'vitest'

import { TransactionsDescriptionAutocomplete } from '@/features/transactions/components/transactions-description-autocomplete'
import type { TransactionCreateFormData } from '@/schemas/transaction.schema'
import { fireEvent, renderWithProviders, screen } from '../../../../setup/render'

type HarnessProps = {
  suggestions: string[]
  onSubmit?: () => void
}

function DescriptionAutocompleteHarness({
  suggestions,
  onSubmit = () => {},
}: HarnessProps) {
  const form = useForm<TransactionCreateFormData>({
    defaultValues: {
      accountId: '',
      categoryId: '',
      subcategoryId: '',
      type: 'expense',
      amount: '10',
      date: '2026-04-25',
      description: '',
      notes: '',
    },
  })
  const descriptionInputRef = useRef<HTMLInputElement | null>(null)
  const [isDescriptionSuggestionsOpen, setIsDescriptionSuggestionsOpen] =
    useState(false)
  const [isDescriptionFocused, setIsDescriptionFocused] = useState(false)
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0)

  return (
    <form
      onSubmit={(event: FormEvent) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <TransactionsDescriptionAutocomplete
        descriptionRegister={form.register('description')}
        descriptionInputRef={descriptionInputRef}
        isInvalid={false}
        descriptionSuggestions={suggestions}
        areDescriptionSuggestionsLoading={false}
        hasDescriptionSuggestionsError={false}
        shouldFilterSuggestions={true}
        isDescriptionSuggestionsOpen={isDescriptionSuggestionsOpen}
        setIsDescriptionSuggestionsOpen={setIsDescriptionSuggestionsOpen}
        isDescriptionFocused={isDescriptionFocused}
        setIsDescriptionFocused={setIsDescriptionFocused}
        activeSuggestionIndex={activeSuggestionIndex}
        setActiveSuggestionIndex={setActiveSuggestionIndex}
        setValue={form.setValue}
      />
      <button type="submit">Salvar</button>
    </form>
  )
}

describe('TransactionsDescriptionAutocomplete', () => {
  it('deve mostrar sugestões ao digitar parte da descrição', () => {
    renderWithProviders(
      <DescriptionAutocompleteHarness suggestions={['Aluguel', 'Academia']} />,
    )

    const input = screen.getByPlaceholderText('Ex: Supermercado')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'Alu' } })

    expect(screen.getByText('Aluguel')).toBeInTheDocument()
    expect(screen.getByText('Academia')).toBeInTheDocument()
  })

  it('deve navegar com setas e selecionar sugestão com Enter', () => {
    renderWithProviders(
      <DescriptionAutocompleteHarness suggestions={['Supermercado', 'Padaria']} />,
    )

    const input = screen.getByPlaceholderText('Ex: Supermercado')
    fireEvent.focus(input)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect((input as HTMLInputElement).value).toBe('Padaria')
  })

  it('deve fechar sugestões com Escape sem submeter o formulário', () => {
    const onSubmit = vi.fn()
    renderWithProviders(
      <DescriptionAutocompleteHarness
        suggestions={['Assinatura']}
        onSubmit={onSubmit}
      />,
    )

    const input = screen.getByPlaceholderText('Ex: Supermercado')
    fireEvent.focus(input)
    expect(screen.getByText('Assinatura')).toBeInTheDocument()

    fireEvent.keyDown(input, { key: 'Escape' })

    expect(screen.queryByText('Assinatura')).not.toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
