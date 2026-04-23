import type { ReactNode, RefObject } from 'react'

import type {
  Transaction,
  TransactionsQueryParams,
} from '@/features/transactions/transactions.api'

type TransactionsTableDesktopProps = {
  transactions: Transaction[]
  isLoading: boolean
  isAmountFilterInvalid: boolean
  amountFilterErrorMessage: string
  selectedIds: Set<string>
  allSelected: boolean
  sortKey: TransactionsQueryParams['sort'] | null
  sortDirection: 'asc' | 'desc'
  selectAllRef: RefObject<HTMLInputElement | null>
  accountMap: Map<string, string>
  categoryMap: Map<string, string>
  dateFormatter: Intl.DateTimeFormat
  onSort: (key: NonNullable<TransactionsQueryParams['sort']>) => void
  onSelectAllChange: (checked: boolean) => void
  onToggleTransactionSelection: (id: string) => void
  onRowClick: (transaction: Transaction) => void
  renderSortIcon: (input: {
    isActive: boolean
    direction: 'asc' | 'desc'
  }) => ReactNode
  formatDateDisplay: (
    value: string | Date | null | undefined,
    formatter: Intl.DateTimeFormat,
  ) => string
  formatCurrencyValue: (value: number) => string
}

export function TransactionsTableDesktop({
  transactions,
  isLoading,
  isAmountFilterInvalid,
  amountFilterErrorMessage,
  selectedIds,
  allSelected,
  sortKey,
  sortDirection,
  selectAllRef,
  accountMap,
  categoryMap,
  dateFormatter,
  onSort,
  onSelectAllChange,
  onToggleTransactionSelection,
  onRowClick,
  renderSortIcon,
  formatDateDisplay,
  formatCurrencyValue,
}: TransactionsTableDesktopProps) {
  return (
    <div className="h-full overflow-y-auto">
      <table className="min-w-[900px] w-full text-sm">
        <thead className="sticky top-0 z-10 bg-muted/40 text-left text-[11px] uppercase text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-muted/70">
          <tr>
                <th className="w-12 px-4 py-2 text-center">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    className="h-4 w-4 cursor-pointer"
                    checked={allSelected}
                    onChange={(event) => onSelectAllChange(event.target.checked)}
                    aria-label="Selecionar todas as transações"
                  />
                </th>
                <th className="px-4 py-2">
                  <button
                    className="inline-flex items-center gap-2 text-left"
                    type="button"
                    onClick={() => onSort('date')}
                  >
                    Data
                    {renderSortIcon({
                      isActive: sortKey === 'date',
                      direction: sortDirection,
                    })}
                  </button>
                </th>
                <th className="px-4 py-2">
                  <button
                    className="inline-flex items-center gap-2 text-left"
                    type="button"
                    onClick={() => onSort('description')}
                  >
                    Descrição
                    {renderSortIcon({
                      isActive: sortKey === 'description',
                      direction: sortDirection,
                    })}
                  </button>
                </th>
                <th className="px-4 py-2">
                  <button
                    className="inline-flex items-center gap-2 text-left"
                    type="button"
                    onClick={() => onSort('account')}
                  >
                    Conta
                    {renderSortIcon({
                      isActive: sortKey === 'account',
                      direction: sortDirection,
                    })}
                  </button>
                </th>
                <th className="px-4 py-2">
                  <button
                    className="inline-flex items-center gap-2 text-left"
                    type="button"
                    onClick={() => onSort('category')}
                  >
                    Categoria
                    {renderSortIcon({
                      isActive: sortKey === 'category',
                      direction: sortDirection,
                    })}
                  </button>
                </th>
                <th className="px-4 py-2">
                  <button
                    className="inline-flex items-center gap-2 text-left"
                    type="button"
                    onClick={() => onSort('subcategory')}
                  >
                    Subcategoria
                    {renderSortIcon({
                      isActive: sortKey === 'subcategory',
                      direction: sortDirection,
                    })}
                  </button>
                </th>
                <th className="px-4 py-2 text-center">
                  <button
                    className="inline-flex items-center gap-2 text-center"
                    type="button"
                    onClick={() => onSort('type')}
                  >
                    Tipo
                    {renderSortIcon({
                      isActive: sortKey === 'type',
                      direction: sortDirection,
                    })}
                  </button>
                </th>
                <th className="px-4 py-2 text-right">
                  <button
                    className="inline-flex items-center gap-2 text-right"
                    type="button"
                    onClick={() => onSort('amount')}
                  >
                    Valor
                    {renderSortIcon({
                      isActive: sortKey === 'amount',
                      direction: sortDirection,
                    })}
                  </button>
                </th>
          </tr>
        </thead>
        <tbody>
          {isLoading && (
            <tr>
              <td className="px-4 py-5 text-muted-foreground" colSpan={8}>
                Carregando transações...
              </td>
            </tr>
          )}
          {!isLoading && isAmountFilterInvalid && (
            <tr>
              <td className="px-4 py-5 text-muted-foreground" colSpan={8}>
                {amountFilterErrorMessage}
              </td>
            </tr>
          )}
          {!isLoading && !isAmountFilterInvalid && transactions.length === 0 && (
            <tr>
              <td className="px-4 py-5 text-muted-foreground" colSpan={8}>
                Nenhuma transação encontrada.
              </td>
            </tr>
          )}
          {transactions.map((transaction) => (
            <tr
              key={transaction.id}
              className="cursor-pointer border-t hover:bg-muted/30"
              onClick={() => onRowClick(transaction)}
            >
              <td
                className="cursor-pointer px-4 py-2 text-center"
                onClick={(event) => {
                  event.stopPropagation()
                  onToggleTransactionSelection(transaction.id)
                }}
                onMouseDown={(event) => event.stopPropagation()}
              >
                <label
                  htmlFor={`transaction-select-${transaction.id}`}
                  className="flex h-full w-full cursor-pointer items-center justify-center rounded-md p-1.5 hover:bg-muted/40"
                  onClick={(event) => event.stopPropagation()}
                  onMouseDown={(event) => event.stopPropagation()}
                >
                  <input
                    id={`transaction-select-${transaction.id}`}
                    type="checkbox"
                    className="h-4 w-4 cursor-pointer"
                    checked={selectedIds.has(transaction.id)}
                    onClick={(event) => event.stopPropagation()}
                    onMouseDown={(event) => event.stopPropagation()}
                    onChange={() => onToggleTransactionSelection(transaction.id)}
                    aria-label="Selecionar transação"
                  />
                </label>
              </td>
              <td className="px-4 py-2">
                {formatDateDisplay(transaction.date, dateFormatter)}
              </td>
              <td className="px-4 py-2">
                <div className="flex items-center gap-2">
                  <span>
                    {transaction.description ||
                      transaction.categoryName ||
                      categoryMap.get(transaction.categoryId) ||
                      'Sem descrição'}
                  </span>
                  {transaction.notes && (
                    <span
                      className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground"
                      title={transaction.notes}
                    >
                      Notas
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-2">
                {transaction.accountName || accountMap.get(transaction.accountId) || '-'}
              </td>
              <td className="px-4 py-2">
                {transaction.categoryName ||
                  categoryMap.get(transaction.categoryId) ||
                  '-'}
              </td>
              <td className="px-4 py-2">
                {transaction.subcategoryId ? transaction.subcategoryName || '-' : '-'}
              </td>
              <td className="px-4 py-2 text-center">
                <span
                  className={
                    transaction.type === 'income'
                      ? 'rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700'
                      : transaction.type === 'expense'
                        ? 'rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700'
                        : 'rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground'
                  }
                >
                  {transaction.type === 'income'
                    ? 'Receita'
                    : transaction.type === 'expense'
                      ? 'Despesa'
                      : '-'}
                </span>
              </td>
              <td
                className={
                  transaction.type === 'income'
                    ? 'sensitive px-4 py-2 text-right font-medium text-emerald-600'
                    : transaction.type === 'expense'
                      ? 'sensitive px-4 py-2 text-right font-medium text-rose-600'
                      : 'sensitive px-4 py-2 text-right font-medium text-muted-foreground'
                }
              >
                {formatCurrencyValue(transaction.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
