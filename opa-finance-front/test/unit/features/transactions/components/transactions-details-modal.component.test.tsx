import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TransactionsDetailsModal } from '@/features/transactions/components/transactions-details-modal'
import type { Transaction } from '@/features/transactions/transactions.api'
import {
  fireEvent,
  renderWithProviders,
  screen,
  waitFor,
} from '../../../../setup/render'

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
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('deve abrir e acionar ações principais', () => {
    const onOpenDuplicate = vi.fn()
    const onOpenEdit = vi.fn()
    const onOpenDelete = vi.fn()

    renderWithProviders(
      <TransactionsDetailsModal
        selectedTransaction={tx}
        categoryMap={new Map()}
        accountMap={new Map()}
        repeatTransferError={null}
        transferEditError={null}
        isRepeatTransferLoading={false}
        isEditTransferLoading={false}
        onClose={() => {}}
        onOpenRepeatTransfer={() => {}}
        onOpenDuplicate={onOpenDuplicate}
        onOpenEdit={onOpenEdit}
        onOpenEditTransfer={() => {}}
        onOpenDelete={onOpenDelete}
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

  it('deve copiar descrição/valor e exibir feedback visual', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: writeTextMock,
      },
    })

    renderWithProviders(
      <TransactionsDetailsModal
        selectedTransaction={tx}
        categoryMap={new Map()}
        accountMap={new Map()}
        repeatTransferError={null}
        transferEditError={null}
        isRepeatTransferLoading={false}
        isEditTransferLoading={false}
        onClose={() => {}}
        onOpenRepeatTransfer={() => {}}
        onOpenDuplicate={() => {}}
        onOpenEdit={() => {}}
        onOpenEditTransfer={() => {}}
        onOpenDelete={() => {}}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Aluguel' }))
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith('Aluguel')
    })
    expect(screen.getByText('Copiado!')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /265/ }))
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledTimes(2)
    })
  })

  it('deve fechar ao clicar no backdrop', () => {
    const onClose = vi.fn()

    const { container } = renderWithProviders(
      <TransactionsDetailsModal
        selectedTransaction={tx}
        categoryMap={new Map()}
        accountMap={new Map()}
        repeatTransferError={null}
        transferEditError={null}
        isRepeatTransferLoading={false}
        isEditTransferLoading={false}
        onClose={onClose}
        onOpenRepeatTransfer={() => {}}
        onOpenDuplicate={() => {}}
        onOpenEdit={() => {}}
        onOpenEditTransfer={() => {}}
        onOpenDelete={() => {}}
      />,
    )

    const backdrop = container.querySelector('.fixed.inset-0.z-50 > .fixed.inset-0')
    if (!backdrop) {
      throw new Error('Backdrop não encontrado.')
    }
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
