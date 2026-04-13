import { describe, expect, it, vi } from 'vitest'

import { TransactionsCreateModal } from '@/features/transactions/components/transactions-create-modal'
import { fireEvent, renderWithProviders, screen } from '../../../../setup/render'

describe('TransactionsCreateModal', () => {
  it('deve renderizar conteúdo quando aberto', () => {
    renderWithProviders(
      <TransactionsCreateModal isOpen={true} onClose={() => {}}>
        <div>Conteúdo teste</div>
      </TransactionsCreateModal>,
    )

    expect(screen.getByText('Nova transação')).toBeInTheDocument()
    expect(screen.getByText('Conteúdo teste')).toBeInTheDocument()
  })

  it('não deve renderizar quando fechado', () => {
    renderWithProviders(
      <TransactionsCreateModal isOpen={false} onClose={() => {}}>
        <div>Conteúdo teste</div>
      </TransactionsCreateModal>,
    )

    expect(screen.queryByText('Nova transação')).not.toBeInTheDocument()
  })

  it('deve chamar onClose ao clicar no backdrop', () => {
    const onClose = vi.fn()
    const { container } = renderWithProviders(
      <TransactionsCreateModal isOpen={true} onClose={onClose}>
        <div>Conteúdo teste</div>
      </TransactionsCreateModal>,
    )

    const backdrops = container.querySelectorAll('div.fixed.inset-0')
    expect(backdrops.length).toBeGreaterThanOrEqual(2)
    fireEvent.click(backdrops[1] as HTMLElement)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
