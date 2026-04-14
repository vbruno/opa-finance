import { fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { DashboardTransactionDetailsModal } from '@/features/dashboard/components/dashboard-transaction-details-modal'

describe('DashboardTransactionDetailsModal', () => {
  it('deve disparar copia da descrição e valor', () => {
    const onCopyDetail = vi.fn()

    render(
      <DashboardTransactionDetailsModal
        selectedTransaction={{
          id: 'tx-1',
          userId: 'u-1',
          accountId: 'a-1',
          accountName: 'Conta principal',
          categoryId: 'c-1',
          categoryName: 'Habitação',
          subcategoryId: null,
          subcategoryName: null,
          type: 'expense',
          amount: 100,
          date: '2026-04-14',
          description: 'Supermercado',
          notes: null,
          transferId: null,
          createdAt: '2026-04-14T10:00:00.000Z',
        }}
        accountNameById={new Map([['a-1', 'Conta principal']])}
        copiedField={null}
        modalRef={createRef<HTMLDivElement>()}
        onClose={vi.fn()}
        onCopyDetail={onCopyDetail}
        formatDateDisplay={() => '14/04/2026'}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /supermercado/i }))
    fireEvent.click(screen.getByRole('button', { name: /100,00/i }))

    expect(onCopyDetail).toHaveBeenCalledTimes(2)
  })
})
