import type { RefObject } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { TransactionsBulkDeleteModal } from '@/features/transactions/components/transactions-bulk-delete-modal'
import { fireEvent, renderWithProviders, screen } from '../../../../setup/render'

describe('TransactionsBulkDeleteModal', () => {
  it('renderiza contagem e dispara ações', () => {
    const onClose = vi.fn()
    const onConfirmDelete = vi.fn()

    renderWithProviders(
      <TransactionsBulkDeleteModal
        isOpen
        selectedCount={3}
        bulkDeleteError={null}
        isBulkDeleting={false}
        bulkDeleteModalRef={{ current: null } as RefObject<HTMLDivElement | null>}
        onClose={onClose}
        onConfirmDelete={onConfirmDelete}
      />,
    )

    expect(screen.getByText(/3 transações selecionadas/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))

    expect(onClose).toHaveBeenCalled()
    expect(onConfirmDelete).toHaveBeenCalled()
  })

  it('mostra erro e estado de loading', () => {
    renderWithProviders(
      <TransactionsBulkDeleteModal
        isOpen
        selectedCount={2}
        bulkDeleteError="Erro ao excluir transações."
        isBulkDeleting
        bulkDeleteModalRef={{ current: null } as RefObject<HTMLDivElement | null>}
        onClose={() => {}}
        onConfirmDelete={() => {}}
      />,
    )

    expect(screen.getByText('Erro ao excluir transações.')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Excluindo...' }),
    ).toBeDisabled()
  })
})
