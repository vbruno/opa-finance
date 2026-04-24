import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TransactionsDeleteConfirmModal } from '@/features/transactions/components/transactions-delete-confirm-modal'
import type { Transaction } from '@/features/transactions/transactions.api'
import {
  fireEvent,
  renderWithProviders,
  screen,
  waitFor,
} from '../../../../setup/render'

const { deleteMutationMock } = vi.hoisted(() => ({
  deleteMutationMock: vi.fn(),
}))

vi.mock('@/features/transactions/transactions.api', async () => {
  const actual = await vi.importActual<
    typeof import('@/features/transactions/transactions.api')
  >('@/features/transactions/transactions.api')

  return {
    ...actual,
    useDeleteTransaction: () => ({
      mutateAsync: deleteMutationMock,
    }),
  }
})

const transactionMock: Transaction = {
  id: 'tx-1',
  userId: 'user-1',
  accountId: 'acc-1',
  accountName: 'CommBank ACC',
  categoryId: 'cat-1',
  categoryName: 'Habitação',
  subcategoryId: null,
  subcategoryName: null,
  type: 'expense',
  amount: 100,
  date: '2026-04-24',
  description: 'Despesa teste',
  notes: null,
  transferId: null,
  createdAt: '2026-04-24T00:00:00.000Z',
}

describe('TransactionsDeleteConfirmModal', () => {
  beforeEach(() => {
    deleteMutationMock.mockReset()
  })

  it('renderiza e dispara ações de fechar/confirmar', () => {
    const onClose = vi.fn()
    const onDeleted = vi.fn()
    deleteMutationMock.mockResolvedValue(undefined)

    renderWithProviders(
      <TransactionsDeleteConfirmModal
        open
        transaction={transactionMock}
        onClose={onClose}
        onDeleted={onDeleted}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))

    expect(onClose).toHaveBeenCalled()
    expect(deleteMutationMock).toHaveBeenCalledWith('tx-1')
    return waitFor(() => {
      expect(onDeleted).toHaveBeenCalled()
    })
  })

  it('mostra loading e erro quando em exclusão', () => {
    let rejectDelete: ((reason?: unknown) => void) | null = null
    deleteMutationMock.mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectDelete = reject
      }),
    )

    renderWithProviders(
      <TransactionsDeleteConfirmModal
        open
        transaction={transactionMock}
        onClose={() => {}}
        onDeleted={() => {}}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))

    expect(
      screen.getByRole('button', { name: 'Excluindo...' }),
    ).toBeDisabled()

    rejectDelete?.(new Error('Falha simulada'))
    return waitFor(() => {
      expect(
        screen.getByText('Erro ao excluir transação. Tente novamente.'),
      ).toBeInTheDocument()
    })
  })
})
