import { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AccountDeleteConfirmModal } from '@/features/accounts/components/account-delete-confirm-modal'

describe('AccountDeleteConfirmModal', () => {
  it('renderiza e chama callbacks de cancelar e confirmar', () => {
    const onClose = vi.fn()
    const onConfirm = vi.fn()

    render(
      <AccountDeleteConfirmModal
        isOpen={true}
        accountName="Conta A"
        isPending={false}
        deleteBlockedReason={null}
        deleteError={null}
        deleteModalRef={createRef<HTMLDivElement>()}
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar exclusão' }))

    expect(onClose).toHaveBeenCalled()
    expect(onConfirm).toHaveBeenCalled()
  })
})
