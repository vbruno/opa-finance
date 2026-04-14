import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { Button } from '@/components/ui/button'
import { DashboardRecentTransactionsCard } from '@/features/dashboard/components/dashboard-recent-transactions-card'

describe('DashboardRecentTransactionsCard', () => {
  it('deve renderizar lista e abrir detalhe da transação', () => {
    const onOpenTransaction = vi.fn()

    render(
      <DashboardRecentTransactionsCard
        isOpen
        showSkeleton={false}
        errorMessage={null}
        transactions={[
          {
            id: 'tx-1',
            userId: 'u-1',
            accountId: 'a-1',
            accountName: 'Conta principal',
            categoryId: 'c-1',
            categoryName: 'Habitação',
            subcategoryId: 's-1',
            subcategoryName: 'Aluguel',
            type: 'expense',
            amount: 120,
            date: '2026-04-14',
            description: 'Aluguel abril',
            notes: null,
            transferId: null,
            createdAt: '2026-04-14T10:00:00.000Z',
          },
        ]}
        onToggleOpen={vi.fn()}
        onOpenTransaction={onOpenTransaction}
        formatDateDisplay={() => '14/04/2026'}
        viewAllAction={<Button size="sm">Ver todas</Button>}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /aluguel abril/i }))
    expect(onOpenTransaction).toHaveBeenCalledTimes(1)
    expect(screen.getByText('14/04/2026')).toBeInTheDocument()
  })
})
