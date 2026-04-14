import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { Button } from '@/components/ui/button'
import { DashboardTopCategoryTransactionsModal } from '@/features/dashboard/components/dashboard-top-category-transactions-modal'

describe('DashboardTopCategoryTransactionsModal', () => {
  it('deve abrir detalhe da transação ao clicar em item', () => {
    const onOpenTransaction = vi.fn()

    render(
      <DashboardTopCategoryTransactionsModal
        selectedTopCategory={{
          id: 'c-1',
          name: 'Habitação',
          groupBy: 'category',
          type: 'expense',
        }}
        isLoading={false}
        errorMessage={null}
        transactions={[
          {
            id: 'tx-1',
            userId: 'u-1',
            accountId: 'a-1',
            categoryId: 'c-1',
            subcategoryId: null,
            type: 'expense',
            amount: 80,
            date: '2026-04-14',
            description: 'Conta de luz',
            notes: null,
            transferId: null,
            createdAt: '2026-04-14T10:00:00.000Z',
          },
        ]}
        onClose={vi.fn()}
        onOpenTransaction={onOpenTransaction}
        formatDateDisplay={() => '14/04/2026'}
        viewAllAction={<Button size="sm">Ver todas</Button>}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /conta de luz/i }))
    expect(onOpenTransaction).toHaveBeenCalledTimes(1)
  })
})
