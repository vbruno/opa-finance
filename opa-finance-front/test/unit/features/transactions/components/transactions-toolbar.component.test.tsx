import { describe, expect, it, vi } from 'vitest'

import { TransactionsToolbar } from '@/features/transactions/components/transactions-toolbar'
import { fireEvent, renderWithProviders, screen } from '../../../../setup/render'

describe('TransactionsToolbar', () => {
  it('deve renderizar e abrir menu de criação', () => {
    const setIsFiltersOpen = vi.fn()
    const setIsCreateMenuOpen = vi.fn()
    const onOpenTransactionCreate = vi.fn()
    const onOpenTransferCreate = vi.fn()

    renderWithProviders(
      <TransactionsToolbar
        isFiltersOpen={false}
        hasActiveFilters={false}
        isCreateMenuOpen={true}
        setIsFiltersOpen={setIsFiltersOpen}
        setIsCreateMenuOpen={setIsCreateMenuOpen}
        onOpenTransactionCreate={onOpenTransactionCreate}
        onOpenTransferCreate={onOpenTransferCreate}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Transações' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Transação/ }))
    expect(onOpenTransactionCreate).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: /Transferência/ }))
    expect(onOpenTransferCreate).toHaveBeenCalledTimes(1)
  })
})
