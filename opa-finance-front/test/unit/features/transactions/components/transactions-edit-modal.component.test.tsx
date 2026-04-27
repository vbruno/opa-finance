import { describe, expect, it, vi } from 'vitest'

import { TransactionsEditModal } from '@/features/transactions/components/transactions-edit-modal'
import type { Transaction } from '@/features/transactions/transactions.api'
import { fireEvent, renderWithProviders, screen } from '../../../../setup/render'

const tx: Transaction = {
  id: 'tx-1',
  userId: 'user-1',
  accountId: 'acc-1',
  accountName: 'Conta Principal',
  categoryId: 'cat-1',
  categoryName: 'Habitação',
  subcategoryId: null,
  subcategoryName: null,
  type: 'expense',
  amount: 265,
  date: '2026-03-01',
  description: 'Aluguel',
  notes: null,
  transferId: null,
  createdAt: '2026-03-01T00:00:00.000Z',
}

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onSuccess: vi.fn(),
  transaction: tx,
  accounts: [],
  categories: [],
  availableCategories: [],
}

describe('TransactionsEditModal', () => {
  it('não renderiza quando isOpen=false', () => {
    renderWithProviders(<TransactionsEditModal {...defaultProps} isOpen={false} />)
    expect(screen.queryByText('Editar transação')).not.toBeInTheDocument()
  })

  it('renderiza título quando isOpen=true com transação', () => {
    renderWithProviders(<TransactionsEditModal {...defaultProps} />)
    expect(screen.getByRole('heading', { name: 'Editar transação' })).toBeInTheDocument()
  })

  it('chama onClose ao clicar no botão Cancelar', () => {
    const onClose = vi.fn()
    renderWithProviders(<TransactionsEditModal {...defaultProps} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('chama onClose ao clicar no backdrop', () => {
    const onClose = vi.fn()
    const { container } = renderWithProviders(
      <TransactionsEditModal {...defaultProps} onClose={onClose} />,
    )
    const backdrops = container.querySelectorAll('div.fixed.inset-0')
    expect(backdrops.length).toBeGreaterThanOrEqual(2)
    fireEvent.click(backdrops[1] as HTMLElement)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('bloqueia campo de categoria para transação de transferência', () => {
    const transferTransaction: Transaction = { ...tx, transferId: 'transfer-1' }
    renderWithProviders(
      <TransactionsEditModal {...defaultProps} transaction={transferTransaction} />,
    )
    expect(
      screen.getByText('Categoria e subcategoria de transferências não podem ser alteradas.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('combobox', { name: /Categoria\/Subcategoria/i }),
    ).toHaveAttribute('data-disabled')
  })
})
