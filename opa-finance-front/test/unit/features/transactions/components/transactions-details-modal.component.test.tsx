import type { RefObject } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { TransactionsDetailsModal } from '@/features/transactions/components/transactions-details-modal'
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

describe('TransactionsDetailsModal', () => {
  it('deve abrir e acionar ações principais', () => {
    const onOpenDuplicate = vi.fn()
    const onOpenEdit = vi.fn()
    const onOpenDelete = vi.fn()

    renderWithProviders(
      <TransactionsDetailsModal
        selectedTransaction={tx}
        detailModalRef={{ current: null } as RefObject<HTMLDivElement | null>}
        detailCopiedField={null}
        dateFormatter={new Intl.DateTimeFormat('pt-BR')}
        categoryMap={new Map()}
        accountMap={new Map()}
        repeatTransferError={null}
        transferEditError={null}
        isRepeatTransferLoading={false}
        isEditTransferLoading={false}
        onClose={() => {}}
        onCopyDetail={async () => {}}
        onOpenRepeatTransfer={() => {}}
        onOpenDuplicate={onOpenDuplicate}
        onOpenEdit={onOpenEdit}
        onOpenEditTransfer={() => {}}
        onOpenDelete={onOpenDelete}
        formatDateDisplay={() => '01/03/2026'}
        formatCurrencyValue={() => '$ 265,00'}
      />,
    )

    expect(screen.getByText('Detalhes da transação')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Duplicar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))
    expect(onOpenDuplicate).toHaveBeenCalledWith(tx)
    expect(onOpenEdit).toHaveBeenCalledWith(tx)
    expect(onOpenDelete).toHaveBeenCalledWith(tx)
  })
})
