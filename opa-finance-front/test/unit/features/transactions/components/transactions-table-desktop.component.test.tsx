import type { RefObject } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { TransactionsTableDesktop } from '@/features/transactions/components/transactions-table-desktop'
import type { Transaction } from '@/features/transactions/transactions.api'
import { fireEvent, renderWithProviders, screen } from '../../../../setup/render'

const dateFormatter = new Intl.DateTimeFormat('pt-BR')

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
  notes: 'mensal',
  transferId: null,
  createdAt: '2026-03-01T00:00:00.000Z',
}

describe('TransactionsTableDesktop', () => {
  it('deve disparar callbacks de sort, seleção e clique na linha', () => {
    const onSort = vi.fn()
    const onSelectAllChange = vi.fn()
    const onToggleTransactionSelection = vi.fn()
    const onRowClick = vi.fn()

    renderWithProviders(
      <TransactionsTableDesktop
        transactions={[tx]}
        isLoading={false}
        isAmountFilterInvalid={false}
        amountFilterErrorMessage=""
        selectedIds={new Set<string>()}
        allSelected={false}
        sortKey="date"
        sortDirection="desc"
        selectAllRef={{ current: null } as RefObject<HTMLInputElement | null>}
        accountMap={new Map()}
        categoryMap={new Map()}
        dateFormatter={dateFormatter}
        onSort={onSort}
        onSelectAllChange={onSelectAllChange}
        onToggleTransactionSelection={onToggleTransactionSelection}
        onRowClick={onRowClick}
        renderSortIcon={() => null}
        formatDateDisplay={(value, formatter) =>
          formatter.format(new Date(String(value)))
        }
        formatCurrencyValue={(value) => String(value)}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Data' }))
    expect(onSort).toHaveBeenCalledWith('date')

    fireEvent.click(screen.getByLabelText('Selecionar todas as transações'))
    expect(onSelectAllChange).toHaveBeenCalledWith(true)

    fireEvent.click(screen.getByLabelText('Selecionar transação'))
    expect(onToggleTransactionSelection).toHaveBeenCalledWith('tx-1')

    fireEvent.click(screen.getByText('Aluguel'))
    expect(onRowClick).toHaveBeenCalledWith(tx)
  })
})
