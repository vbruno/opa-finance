import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AccountsPagination } from '@/features/accounts/components/accounts-pagination'

describe('AccountsPagination', () => {
  it('não renderiza quando não precisa paginar', () => {
    const { container } = render(
      <AccountsPagination
        sortedAccountsCount={10}
        pageSize={10}
        safePage={1}
        totalPages={1}
        onChangePageSize={vi.fn()}
        onFirstPage={vi.fn()}
        onPreviousPage={vi.fn()}
        onNextPage={vi.fn()}
        onLastPage={vi.fn()}
      />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('executa callbacks de navegação', () => {
    const onChangePageSize = vi.fn()
    const onFirstPage = vi.fn()
    const onPreviousPage = vi.fn()
    const onNextPage = vi.fn()
    const onLastPage = vi.fn()

    render(
      <AccountsPagination
        sortedAccountsCount={40}
        pageSize={10}
        safePage={2}
        totalPages={4}
        onChangePageSize={onChangePageSize}
        onFirstPage={onFirstPage}
        onPreviousPage={onPreviousPage}
        onNextPage={onNextPage}
        onLastPage={onLastPage}
      />,
    )

    fireEvent.change(screen.getByLabelText('Quantidade de linhas'), {
      target: { value: '20' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Primeira' }))
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }))
    fireEvent.click(screen.getByRole('button', { name: 'Proxima' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ultima' }))

    expect(onChangePageSize).toHaveBeenCalledWith(20)
    expect(onFirstPage).toHaveBeenCalled()
    expect(onPreviousPage).toHaveBeenCalled()
    expect(onNextPage).toHaveBeenCalled()
    expect(onLastPage).toHaveBeenCalled()
  })
})
