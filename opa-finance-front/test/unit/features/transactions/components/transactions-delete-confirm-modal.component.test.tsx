import type { RefObject } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { TransactionsDeleteConfirmModal } from '@/features/transactions/components/transactions-delete-confirm-modal'
import { fireEvent, renderWithProviders, screen } from '../../../../setup/render'

describe('TransactionsDeleteConfirmModal', () => {
  it('renderiza e dispara ações de fechar/confirmar', () => {
    const onClose = vi.fn()
    const onConfirmDelete = vi.fn()

    renderWithProviders(
      <TransactionsDeleteConfirmModal
        isOpen
        deleteError={null}
        isDeleting={false}
        deleteModalRef={{ current: null } as RefObject<HTMLDivElement | null>}
        onClose={onClose}
        onConfirmDelete={onConfirmDelete}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))

    expect(onClose).toHaveBeenCalled()
    expect(onConfirmDelete).toHaveBeenCalled()
  })

  it('mostra loading e erro quando em exclusão', () => {
    renderWithProviders(
      <TransactionsDeleteConfirmModal
        isOpen
        deleteError="Erro ao excluir transação."
        isDeleting
        deleteModalRef={{ current: null } as RefObject<HTMLDivElement | null>}
        onClose={() => {}}
        onConfirmDelete={() => {}}
      />,
    )

    expect(screen.getByText('Erro ao excluir transação.')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Excluindo...' }),
    ).toBeDisabled()
  })
})
