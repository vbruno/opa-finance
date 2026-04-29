import { useRef } from 'react'
import { useForm } from 'react-hook-form'
import { describe, expect, it, vi } from 'vitest'

import { TransactionCategoryField } from '@/features/transactions/components/transaction-category-field'
import { renderWithProviders, screen } from '../../../../setup/render'

function CategoryFieldHarness({
  disabled = false,
  disabledMessage,
}: {
  disabled?: boolean
  disabledMessage?: string
}) {
  const form = useForm({ defaultValues: { categoryId: '', subcategoryId: '' } })
  const contentRef = useRef<HTMLDivElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  return (
    <TransactionCategoryField
      id="test-category"
      control={form.control}
      errors={form.formState.errors}
      isOpen={false}
      options={[]}
      search=""
      onSearchChange={vi.fn()}
      contentRef={contentRef}
      searchInputRef={searchInputRef}
      tabIndex={4}
      disabled={disabled}
      disabledMessage={disabledMessage}
      getCategoryTreeValue={() => '__none__'}
      onValueChange={vi.fn()}
      onOpenChange={vi.fn()}
      onSearchKeyDown={vi.fn()}
      onItemKeyDown={vi.fn()}
    />
  )
}

describe('TransactionCategoryField', () => {
  it('renderiza label "Categoria/Subcategoria"', () => {
    renderWithProviders(<CategoryFieldHarness />)
    expect(screen.getByText('Categoria/Subcategoria')).toBeInTheDocument()
  })

  it('exibe mensagem de desabilitado quando disabledMessage é fornecido', () => {
    renderWithProviders(
      <CategoryFieldHarness
        disabled={true}
        disabledMessage="Categoria e subcategoria de transferências não podem ser alteradas."
      />,
    )
    expect(
      screen.getByText('Categoria e subcategoria de transferências não podem ser alteradas.'),
    ).toBeInTheDocument()
  })

  it('aplica data-disabled no combobox quando disabled=true', () => {
    renderWithProviders(<CategoryFieldHarness disabled={true} />)
    expect(
      screen.getByRole('combobox', { name: /Categoria\/Subcategoria/i }),
    ).toHaveAttribute('data-disabled')
  })
})
