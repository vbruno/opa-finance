import { ChevronDown, ChevronRight } from 'lucide-react'
import { useMemo } from 'react'

import { Button } from '@/components/ui/button'
import { useConsolidatedExpansion } from '@/features/consolidated/hooks/use-consolidated-expansion'
import { buildSectionMonthlyVariation } from '@/features/consolidated/mappers/consolidated-balance.mapper'
import { CONSOLIDATED_MONTH_LABELS } from '@/features/consolidated/model/consolidated.constants'
import {
  formatBalanceCell,
  formatVariationPercent,
  getBalanceCellAlignmentClass,
  getVariationToneClass,
  resolveSubcategoryDisplayName,
} from '@/features/consolidated/model/consolidated.helpers'
import type { ConsolidatedSectionTone } from '@/features/consolidated/model/consolidated.types'
import type { ConsolidatedLine } from '@/features/reports'

type ConsolidatedBalanceSectionTableProps = {
  sectionLabel: string
  sectionTone: ConsolidatedSectionTone
  data: ConsolidatedLine[]
  totals: { months: number[]; yearTotal: number }
}

export function ConsolidatedBalanceSectionTable({
  sectionLabel,
  sectionTone,
  data,
  totals,
}: ConsolidatedBalanceSectionTableProps) {
  const sectionClass =
    sectionTone === 'income'
      ? 'border-emerald-500/25 bg-emerald-500/10'
      : 'border-red-500/25 bg-red-500/10'
  const allCategoryIds = useMemo(
    () => data.map((category) => category.categoryId),
    [data],
  )
  const {
    collapsedCategoryIds,
    areAllCollapsed,
    toggleCategory,
    expandAll,
    collapseAll,
  } = useConsolidatedExpansion(allCategoryIds)
  const monthlyVariationPercents = useMemo(
    () => buildSectionMonthlyVariation(totals.months),
    [totals.months],
  )

  return (
    <section className="rounded-lg border">
      <div className={`flex items-center justify-between gap-2 border-b px-3 py-2 ${sectionClass}`}>
        <h2 className="text-sm font-semibold">{sectionLabel}</h2>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={areAllCollapsed ? expandAll : collapseAll}
          >
            {areAllCollapsed ? 'Expandir tudo' : 'Recolher tudo'}
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1100px] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left">
              <th className="sticky left-0 z-10 min-w-[260px] bg-muted/40 px-3 py-2 font-medium">
                Categoria / Subcategoria
              </th>
              {CONSOLIDATED_MONTH_LABELS.map((label) => (
                <th
                  key={`${sectionLabel}-${label}`}
                  className="px-2 py-2 text-center font-medium"
                >
                  {label}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-semibold">Total/Ano</th>
            </tr>
          </thead>

          <tbody>
            <tr className="border-b bg-muted/10">
              <td className="sticky left-0 bg-muted/10 px-3 py-2 text-xs font-medium text-muted-foreground">
                Variação vs mês anterior (%)
              </td>
              {monthlyVariationPercents.map((value, index) => (
                <td
                  key={`${sectionLabel}-variation-${index}`}
                  className={`px-2 py-2 text-center text-xs font-medium ${getVariationToneClass(sectionTone, value)}`}
                >
                  {formatVariationPercent(value)}
                </td>
              ))}
              <td className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">
                -
              </td>
            </tr>

            {data.map((category) => (
              <CategoryRows
                key={`${sectionLabel}-${category.categoryId}`}
                category={category}
                isCollapsed={collapsedCategoryIds.has(category.categoryId)}
                onToggle={() => toggleCategory(category.categoryId)}
              />
            ))}

            <tr className="border-t-2 bg-muted/30">
              <td className="sticky left-0 bg-muted/30 px-3 py-2 font-bold">
                {`Total geral ${sectionLabel.toLowerCase()}`}
              </td>
              {totals.months.map((value, index) => (
                <td
                  key={`${sectionLabel}-total-${index}`}
                  className={`px-2 py-2 font-bold ${getBalanceCellAlignmentClass(value)}`}
                >
                  {formatBalanceCell(value)}
                </td>
              ))}
              <td
                className={`px-3 py-2 font-bold ${getBalanceCellAlignmentClass(
                  totals.yearTotal,
                )}`}
              >
                {formatBalanceCell(totals.yearTotal)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}

function CategoryRows({
  category,
  isCollapsed,
  onToggle,
}: {
  category: ConsolidatedLine
  isCollapsed: boolean
  onToggle: () => void
}) {
  const hasSubcategories = category.subcategories.length > 0

  return (
    <>
      <tr className="border-b bg-muted/10">
        <td className="sticky left-0 bg-muted/10 px-3 py-2 font-medium">
          <div className="flex items-center gap-2">
            {hasSubcategories ? (
              <button
                type="button"
                className="rounded p-0.5 hover:bg-background/80"
                onClick={onToggle}
                aria-label={
                  isCollapsed
                    ? `Expandir categoria ${category.categoryName}`
                    : `Recolher categoria ${category.categoryName}`
                }
                title={
                  isCollapsed
                    ? `Expandir ${category.categoryName}`
                    : `Recolher ${category.categoryName}`
                }
              >
                {isCollapsed ? (
                  <ChevronRight className="size-4" />
                ) : (
                  <ChevronDown className="size-4" />
                )}
              </button>
            ) : (
              <span className="inline-block size-5" />
            )}
            <span>{category.categoryName}</span>
          </div>
        </td>
        {category.months.map((value, index) => (
          <td
            key={`${category.categoryId}-month-${index}`}
            className={`px-2 py-2 font-medium ${getBalanceCellAlignmentClass(value)}`}
          >
            {formatBalanceCell(value)}
          </td>
        ))}
        <td
          className={`px-3 py-2 font-semibold ${getBalanceCellAlignmentClass(
            category.yearTotal,
          )}`}
        >
          {formatBalanceCell(category.yearTotal)}
        </td>
      </tr>

      {!isCollapsed &&
        category.subcategories.map((subcategory) => (
          <tr key={subcategory.subcategoryId} className="border-b">
            <td className="sticky left-0 bg-background px-3 py-2 text-muted-foreground">
              <span className="inline-block pl-4">
                {resolveSubcategoryDisplayName(
                  category.categoryName,
                  subcategory.subcategoryName,
                )}
              </span>
            </td>
            {subcategory.months.map((value, index) => (
              <td
                key={`${subcategory.subcategoryId}-month-${index}`}
                className={`px-2 py-2 text-muted-foreground ${getBalanceCellAlignmentClass(value)}`}
              >
                {formatBalanceCell(value)}
              </td>
            ))}
            <td
              className={`px-3 py-2 text-muted-foreground ${getBalanceCellAlignmentClass(
                subcategory.yearTotal,
              )}`}
            >
              {formatBalanceCell(subcategory.yearTotal)}
            </td>
          </tr>
        ))}
    </>
  )
}
