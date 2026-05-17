import { PieChart as PieChartIcon } from 'lucide-react'
import { useMemo } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { CategoryBreakdownItem } from '@/features/transactions/transactions.api'
import { formatCurrencyValue } from '@/lib/utils'

const FALLBACK_COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
]

const percentFormatter = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 1,
})

type DashboardCategoryBreakdownCardProps = {
  showSkeleton: boolean
  errorMessage: string | null
  items: CategoryBreakdownItem[]
  title?: string
  emptyMessage?: string
  className?: string
}

export function DashboardCategoryBreakdownCard({
  showSkeleton,
  errorMessage,
  items,
  title = 'Gastos por categoria',
  emptyMessage = 'Sem gastos no período.',
  className,
}: DashboardCategoryBreakdownCardProps) {
  const enriched = useMemo(
    () =>
      items.map((item, index) => ({
        ...item,
        fill: item.color ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length],
      })),
    [items],
  )

  const chartConfig = useMemo<ChartConfig>(() => {
    const config: ChartConfig = {}
    for (const item of enriched) {
      config[item.categoryName] = {
        label: item.categoryName,
        color: item.fill,
      }
    }
    return config
  }, [enriched])

  return (
    <div className={`@container rounded-lg border bg-background p-4 ${className ?? ''}`}>
      <div className="flex items-start gap-3">
        <PieChartIcon className="h-6 w-6 text-muted-foreground" />
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">No período selecionado</p>
        </div>
      </div>

      <div className="mt-4">
        {showSkeleton && (
          <div className="h-64 w-full animate-pulse rounded-md bg-muted/40" />
        )}
        {!showSkeleton && errorMessage && (
          <p className="text-sm text-destructive">{errorMessage}</p>
        )}
        {!showSkeleton && !errorMessage && enriched.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </p>
        )}
        {!showSkeleton && !errorMessage && enriched.length > 0 && (
          <div className="flex flex-col gap-4">
            <ChartContainer
              config={chartConfig}
              className="mx-auto aspect-square h-56 w-full max-w-[16rem]"
            >
              <ResponsiveContainer>
                <PieChart>
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        hideLabel
                        nameKey="categoryName"
                        formatter={(value, name, item) => (
                          <>
                            <span
                              className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-[2px]"
                              style={{
                                background:
                                  (item.payload as { fill?: string } | undefined)
                                    ?.fill ?? 'var(--color-chart-1)',
                              }}
                            />
                            <div className="flex flex-1 items-center justify-between gap-3 leading-none">
                              <span className="text-muted-foreground">
                                {String(name)}
                              </span>
                              <span className="font-mono font-medium text-foreground tabular-nums">
                                {formatCurrencyValue(Number(value))}
                              </span>
                            </div>
                          </>
                        )}
                      />
                    }
                  />
                  <Pie
                    data={enriched}
                    dataKey="totalAmount"
                    nameKey="categoryName"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {enriched.map((item) => (
                      <Cell key={item.categoryId} fill={item.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>

            <ul className="hidden grid-cols-1 gap-x-4 gap-y-2 @md:grid @md:grid-cols-2">
              {enriched.map((item) => (
                <li
                  key={item.categoryId}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: item.fill }}
                    />
                    <span className="truncate">{item.categoryName}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-right">
                    <span className="text-muted-foreground">
                      {percentFormatter.format(item.percentage)}%
                    </span>
                    <span className="font-medium">
                      {formatCurrencyValue(item.totalAmount)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
