import { describe, expect, it, vi } from 'vitest'

import { TransactionsCreateModal } from '@/features/transactions/components/transactions-create-modal'
import { fireEvent, renderWithProviders, screen } from '../../../../setup/render'

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onSuccess: vi.fn(),
  accounts: [],
  categories: [],
  availableCategories: [],
}

describe('TransactionsCreateModal', () => {
  it('não renderiza quando isOpen=false', () => {
    renderWithProviders(
      <TransactionsCreateModal {...defaultProps} isOpen={false} />,
    )
    expect(screen.queryByText('Nova transação')).not.toBeInTheDocument()
  })

  it('renderiza título quando isOpen=true', () => {
    renderWithProviders(<TransactionsCreateModal {...defaultProps} />)
    expect(screen.getByRole('heading', { name: 'Nova transação' })).toBeInTheDocument()
  })

  it('renderiza campos principais do formulário', () => {
    renderWithProviders(<TransactionsCreateModal {...defaultProps} />)
    expect(screen.getByText('Conta')).toBeInTheDocument()
    expect(screen.getByText('Data')).toBeInTheDocument()
    expect(screen.getByText('Categoria/Subcategoria')).toBeInTheDocument()
    expect(screen.getByText('Valor')).toBeInTheDocument()
    expect(screen.getByText('Descrição')).toBeInTheDocument()
  })

  it('chama onClose ao clicar no backdrop', () => {
    const onClose = vi.fn()
    const { container } = renderWithProviders(
      <TransactionsCreateModal {...defaultProps} onClose={onClose} />,
    )
    const backdrops = container.querySelectorAll('div.fixed.inset-0')
    expect(backdrops.length).toBeGreaterThanOrEqual(2)
    fireEvent.click(backdrops[1] as HTMLElement)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
