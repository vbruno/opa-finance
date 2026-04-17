import { CONSOLIDATED_MONTH_LABELS } from '@/features/consolidated/model/consolidated.constants'
import {
  formatBalanceCell,
  getForecastToneClass,
} from '@/features/consolidated/model/consolidated.helpers'
import type { RecurrenceForecastResponse } from '@/features/reports'

type ConsolidatedForecastTotalsTableProps = {
  forecast: RecurrenceForecastResponse
}

export function ConsolidatedForecastTotalsTable({
  forecast,
}: ConsolidatedForecastTotalsTableProps) {
  const blocks = [
    {
      key: 'income',
      label: 'Receitas',
      real: forecast.totals.real.income,
      projected: forecast.totals.projected.income,
      combined: forecast.totals.combined.income,
      tone: 'income' as const,
    },
    {
      key: 'expense',
      label: 'Despesas',
      real: forecast.totals.real.expense,
      projected: forecast.totals.projected.expense,
      combined: forecast.totals.combined.expense,
      tone: 'expense' as const,
    },
    {
      key: 'balance',
      label: 'Resultado',
      real: forecast.totals.real.balance,
      projected: forecast.totals.projected.balance,
      combined: forecast.totals.combined.balance,
      tone: 'balance' as const,
    },
  ]

  return (
    <section className="rounded-lg border border-sky-500/30 bg-sky-500/5">
      <div className="border-b border-sky-500/20 px-3 py-2">
        <h2 className="text-sm font-semibold">Visão com projeção (real + projetado)</h2>
        <p className="text-xs text-muted-foreground">
          Meses futuros mostram parcela projetada sem materializar lançamentos no banco.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[1100px] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left">
              <th className="sticky left-0 z-10 min-w-[170px] bg-muted/40 px-3 py-2 font-medium">
                Indicador
              </th>
              {CONSOLIDATED_MONTH_LABELS.map((label) => (
                <th key={`forecast-head-${label}`} className="px-2 py-2 text-center font-medium">
                  {label}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-semibold">Total/Ano</th>
            </tr>
          </thead>
          <tbody>
            {blocks.flatMap((block) => [
              <tr key={`${block.key}-real`} className="border-b">
                <td className="sticky left-0 bg-background px-3 py-2 font-medium">
                  {block.label} (real)
                </td>
                {block.real.months.map((value, index) => (
                  <td
                    key={`${block.key}-real-${index}`}
                    className={`px-2 py-2 text-center ${getForecastToneClass(block.tone, value)}`}
                  >
                    {formatBalanceCell(value)}
                  </td>
                ))}
                <td className={`px-3 py-2 text-right ${getForecastToneClass(block.tone, block.real.yearTotal)}`}>
                  {formatBalanceCell(block.real.yearTotal)}
                </td>
              </tr>,
              <tr key={`${block.key}-projected`} className="border-b bg-sky-500/5">
                <td className="sticky left-0 bg-sky-500/5 px-3 py-2 font-medium text-sky-600">
                  {block.label} (projetado)
                </td>
                {block.projected.months.map((value, index) => (
                  <td
                    key={`${block.key}-projected-${index}`}
                    className={`px-2 py-2 text-center ${getForecastToneClass(block.tone, value)}`}
                  >
                    {formatBalanceCell(value)}
                  </td>
                ))}
                <td className={`px-3 py-2 text-right ${getForecastToneClass(block.tone, block.projected.yearTotal)}`}>
                  {formatBalanceCell(block.projected.yearTotal)}
                </td>
              </tr>,
              <tr key={`${block.key}-combined`} className="border-b bg-muted/10">
                <td className="sticky left-0 bg-muted/10 px-3 py-2 font-semibold">
                  {block.label} (combinado)
                </td>
                {block.combined.months.map((value, index) => (
                  <td
                    key={`${block.key}-combined-${index}`}
                    className={`px-2 py-2 text-center font-semibold ${getForecastToneClass(block.tone, value)}`}
                  >
                    {formatBalanceCell(value)}
                  </td>
                ))}
                <td className={`px-3 py-2 text-right font-semibold ${getForecastToneClass(block.tone, block.combined.yearTotal)}`}>
                  {formatBalanceCell(block.combined.yearTotal)}
                </td>
              </tr>,
            ])}
          </tbody>
        </table>
      </div>
    </section>
  )
}
