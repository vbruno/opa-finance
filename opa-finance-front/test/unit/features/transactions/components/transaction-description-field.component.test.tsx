import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { describe, expect, it, vi } from 'vitest'

import { TransactionDescriptionField } from '@/features/transactions/components/transaction-description-field'
import { fireEvent, renderWithProviders, screen } from '../../../../setup/render'

function DescriptionFieldHarness({ suggestions = [] }: { suggestions?: string[] }) {
  const form = useForm({ defaultValues: { description: '' } })
  const descriptionInputRef = useRef<HTMLInputElement | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  return (
    <TransactionDescriptionField
      id="test-description"
      register={form.register}
      errors={form.formState.errors}
      descriptionInputRef={descriptionInputRef}
      setValue={form.setValue}
      descriptionSuggestions={suggestions}
      areDescriptionSuggestionsLoading={false}
      hasDescriptionSuggestionsError={false}
      shouldFilterSuggestions={false}
      isDescriptionSuggestionsOpen={isOpen}
      setIsDescriptionSuggestionsOpen={setIsOpen}
      isDescriptionFocused={isFocused}
      setIsDescriptionFocused={setIsFocused}
      activeSuggestionIndex={activeIndex}
      setActiveSuggestionIndex={setActiveIndex}
    />
  )
}

describe('TransactionDescriptionField', () => {
  it('renderiza label "Descrição" e input com placeholder', () => {
    renderWithProviders(<DescriptionFieldHarness />)
    expect(screen.getByText('Descrição')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Ex: Supermercado')).toBeInTheDocument()
  })

  it('exibe sugestões ao focar e receber sugestões', () => {
    renderWithProviders(<DescriptionFieldHarness suggestions={['Aluguel', 'Academia']} />)
    fireEvent.focus(screen.getByPlaceholderText('Ex: Supermercado'))
    expect(screen.getByText('Aluguel')).toBeInTheDocument()
    expect(screen.getByText('Academia')).toBeInTheDocument()
  })

  it('usa o id fornecido no input', () => {
    renderWithProviders(<DescriptionFieldHarness />)
    expect(screen.getByPlaceholderText('Ex: Supermercado')).toHaveAttribute('id', 'test-description')
  })
})
