import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TransactionsBulkDeleteModal } from '@/features/transactions/components/transactions-bulk-delete-modal'
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

const selectedTransactionsMock: Transaction[] = [
  {
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
    description: 'Despesa A',
    notes: null,
    transferId: null,
    createdAt: '2026-04-24T00:00:00.000Z',
  },
  {
    id: 'tx-2',
    userId: 'user-1',
    accountId: 'acc-1',
    accountName: 'CommBank ACC',
    categoryId: 'cat-1',
    categoryName: 'Habitação',
    subcategoryId: null,
    subcategoryName: null,
    type: 'expense',
    amount: 80,
    date: '2026-04-23',
    description: 'Despesa B',
    notes: null,
    transferId: null,
    createdAt: '2026-04-23T00:00:00.000Z',
  },
  {
    id: 'tx-3',
    userId: 'user-1',
    accountId: 'acc-1',
    accountName: 'CommBank ACC',
    categoryId: 'cat-1',
    categoryName: 'Habitação',
    subcategoryId: null,
    subcategoryName: null,
    type: 'expense',
    amount: 60,
    date: '2026-04-22',
    description: 'Despesa C',
    notes: null,
    transferId: null,
    createdAt: '2026-04-22T00:00:00.000Z',
  },
]

describe('TransactionsBulkDeleteModal', () => {
  beforeEach(() => {
    deleteMutationMock.mockReset()
  })

  it('renderiza contagem e dispara ações', () => {
    const onClose = vi.fn()
    const onDeleted = vi.fn()
    deleteMutationMock.mockResolvedValue(undefined)

    renderWithProviders(
      <TransactionsBulkDeleteModal
        open
        selectedTransactions={selectedTransactionsMock}
        onClose={onClose}
        onDeleted={onDeleted}
      />,
    )

    expect(
      screen.getByText(/excluir 3 transações selecionadas/i),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))

    expect(onClose).toHaveBeenCalled()
    expect(deleteMutationMock).toHaveBeenCalledTimes(3)
    return waitFor(() => {
      expect(onDeleted).toHaveBeenCalled()
    })
  })

  it('mostra erro e estado de loading', () => {
    let rejectDelete: ((reason?: unknown) => void) | null = null
    deleteMutationMock.mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectDelete = reject
      }),
    )
    deleteMutationMock.mockResolvedValue(undefined)

    renderWithProviders(
      <TransactionsBulkDeleteModal
        open
        selectedTransactions={selectedTransactionsMock}
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
        screen.getByText('Erro ao excluir transações. Tente novamente.'),
      ).toBeInTheDocument()
    })
  })
})
