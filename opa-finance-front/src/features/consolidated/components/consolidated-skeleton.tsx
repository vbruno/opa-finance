import { CONSOLIDATED_MONTH_LABELS } from '@/features/consolidated/model/consolidated.constants'

export function ConsolidatedSkeleton() {
  return (
    <div className="space-y-4">
      <section className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={`consolidated-summary-skeleton-${index}`}
            className="animate-pulse rounded-md border px-4 py-3.5"
          >
            <div className="h-4 w-28 rounded bg-muted/60" />
            <div className="mt-2 h-6 w-32 rounded bg-muted/60" />
          </div>
        ))}
      </section>

      <BalanceSectionSkeleton sectionTone="income" />
      <BalanceSectionSkeleton sectionTone="expense" />
    </div>
  )
}

function BalanceSectionSkeleton({ sectionTone }: { sectionTone: 'income' | 'expense' }) {
  const sectionClass =
    sectionTone === 'income'
      ? 'border-emerald-500/25 bg-emerald-500/10'
      : 'border-red-500/25 bg-red-500/10'

  return (
    <section className="rounded-lg border">
      <div className={`border-b px-3 py-2 ${sectionClass}`}>
        <div className="h-4 w-24 animate-pulse rounded bg-muted/60" />
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1100px] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-3 py-2 text-left">
                <div className="h-4 w-40 animate-pulse rounded bg-muted/60" />
              </th>
              {CONSOLIDATED_MONTH_LABELS.map((label) => (
                <th key={`skeleton-${sectionTone}-${label}`} className="px-2 py-2">
                  <div className="ml-auto h-4 w-8 animate-pulse rounded bg-muted/60" />
                </th>
              ))}
              <th className="px-3 py-2">
                <div className="ml-auto h-4 w-16 animate-pulse rounded bg-muted/60" />
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }).map((_, rowIndex) => (
              <tr key={`skeleton-row-${sectionTone}-${rowIndex}`} className="border-b">
                <td className="px-3 py-2">
                  <div className="h-4 w-44 animate-pulse rounded bg-muted/60" />
                </td>
                {Array.from({ length: 12 }).map((__, colIndex) => (
                  <td
                    key={`skeleton-cell-${sectionTone}-${rowIndex}-${colIndex}`}
                    className="px-2 py-2"
                  >
                    <div className="ml-auto h-4 w-12 animate-pulse rounded bg-muted/60" />
                  </td>
                ))}
                <td className="px-3 py-2">
                  <div className="ml-auto h-4 w-14 animate-pulse rounded bg-muted/60" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
