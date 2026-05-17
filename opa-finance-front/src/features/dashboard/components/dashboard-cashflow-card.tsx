import { Activity } from 'lucide-react'
import { useMemo } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { formatCashflowBucketLabel } from '@/features/dashboard/model/dashboard.helpers'
import type {
  CashflowGranularity,
  CashflowPoint,
} from '@/features/transactions/transactions.api'
import { formatCurrencyValue } from '@/lib/utils'

const compactCurrencyFormatter = new Intl.NumberFormat('pt-BR', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

type DashboardCashflowCardProps = {
  showSkeleton: boolean
  errorMessage: string | null
  data: CashflowPoint[]
  granularity: CashflowGranularity
  className?: string
}

const chartConfig = {
  income: {
    label: 'Receitas',
    color: 'var(--color-emerald-500)',
  },
  expense: {
    label: 'Despesas',
    color: 'var(--color-rose-500)',
  },
} satisfies ChartConfig

export function DashboardCashflowCard({
  showSkeleton,
  errorMessage,
  data,
  granularity,
  className,
}: DashboardCashflowCardProps) {
  const enriched = useMemo(
    () =>
      data.map((point) => ({
        ...point,
        label: formatCashflowBucketLabel(point.bucket, granularity),
      })),
    [data, granularity],
  )
  const hasData = enriched.some(
    (point) => point.income !== 0 || point.expense !== 0,
  )

  return (
    <div className={`rounded-lg border bg-background p-4 ${className ?? ''}`}>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Activity className="h-6 w-6 text-muted-foreground" />
          <div>
            <h2 className="text-lg font-semibold">Fluxo de caixa</h2>
            <p className="text-xs text-muted-foreground">
              Receitas e despesas no período
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4">
        {showSkeleton && (
          <div className="h-64 w-full animate-pulse rounded-md bg-muted/40" />
        )}
        {!showSkeleton && errorMessage && (
          <p className="text-sm text-destructive">{errorMessage}</p>
        )}
        {!showSkeleton && !errorMessage && !hasData && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Sem movimentação no período.
          </p>
        )}
        {!showSkeleton && !errorMessage && hasData && (
          <ChartContainer config={chartConfig} className="h-64 w-full">
            <ResponsiveContainer>
              <AreaChart
                data={enriched}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="cashflow-income" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="var(--color-income)"
                      stopOpacity={0.4}
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--color-income)"
                      stopOpacity={0.05}
                    />
                  </linearGradient>
                  <linearGradient id="cashflow-expense" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="var(--color-expense)"
                      stopOpacity={0.4}
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--color-expense)"
                      stopOpacity={0.05}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={24}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={70}
                  tickFormatter={(value: number) =>
                    compactCurrencyFormatter.format(Number(value))
                  }
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => [
                        formatCurrencyValue(Number(value)),
                        name === 'income' ? 'Receitas' : 'Despesas',
                      ]}
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="income"
                  stroke="var(--color-income)"
                  fill="url(#cashflow-income)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="expense"
                  stroke="var(--color-expense)"
                  fill="url(#cashflow-expense)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartContainer>
        )}
      </div>
    </div>
  )
}
