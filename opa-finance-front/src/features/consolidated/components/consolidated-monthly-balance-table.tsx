import { useMemo } from 'react'

import { buildMonthlyBalance, buildMonthlyBalanceDelta } from '@/features/consolidated/mappers/consolidated-balance.mapper'
import { CONSOLIDATED_MONTH_LABELS } from '@/features/consolidated/model/consolidated.constants'
import {
  formatBalanceCell,
  formatBalanceDelta,
  getBalanceCellAlignmentClass,
  getMonthlyBalanceToneClass,
  getMonthlyBalanceVariationToneClass,
} from '@/features/consolidated/model/consolidated.helpers'

type ConsolidatedMonthlyBalanceTableProps = {
  incomeMonths: number[]
  expenseMonths: number[]
  incomeYearTotal: number
  expenseYearTotal: number
}

export function ConsolidatedMonthlyBalanceTable({
  incomeMonths,
  expenseMonths,
  incomeYearTotal,
  expenseYearTotal,
}: ConsolidatedMonthlyBalanceTableProps) {
  const monthlyBalance = useMemo(
    () => buildMonthlyBalance(incomeMonths, expenseMonths),
    [expenseMonths, incomeMonths],
  )
  const monthlyBalanceVariation = useMemo(
    () => buildMonthlyBalanceDelta(monthlyBalance),
    [monthlyBalance],
  )
  const yearBalance = incomeYearTotal - expenseYearTotal

  return (
    <section className="rounded-lg border">
      <div className="border-b bg-muted/20 px-3 py-2">
        <h2 className="text-sm font-semibold">Saldo mensal (Receita - Despesa)</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1100px] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left">
              <th className="sticky left-0 z-10 min-w-[260px] bg-muted/40 px-3 py-2 font-medium">
                Indicador
              </th>
              {CONSOLIDATED_MONTH_LABELS.map((label) => (
                <th key={`monthly-balance-${label}`} className="px-2 py-2 text-center font-medium">
                  {label}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-semibold">Total/Ano</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="sticky left-0 bg-background px-3 py-2 font-medium">Saldo do mês</td>
              {monthlyBalance.map((value, index) => (
                <td
                  key={`monthly-balance-value-${index}`}
                  className={`px-2 py-2 ${getBalanceCellAlignmentClass(value)} ${getMonthlyBalanceToneClass(value)}`}
                >
                  {formatBalanceCell(value)}
                </td>
              ))}
              <td
                className={`px-3 py-2 ${getBalanceCellAlignmentClass(yearBalance)} ${getMonthlyBalanceToneClass(yearBalance)}`}
              >
                {formatBalanceCell(yearBalance)}
              </td>
            </tr>

            <tr className="border-b bg-muted/10">
              <td className="sticky left-0 bg-muted/10 px-3 py-2 text-xs font-medium text-muted-foreground">
                Diferença vs mês anterior
              </td>
              {monthlyBalanceVariation.map((value, index) => (
                <td
                  key={`monthly-balance-variation-${index}`}
                  className={`px-2 py-2 text-center text-xs font-medium ${getMonthlyBalanceVariationToneClass(value)}`}
                >
                  {formatBalanceDelta(value)}
                </td>
              ))}
              <td className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">-</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}
