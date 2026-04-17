import { ArrowDownRight, ArrowUpRight, Wallet } from 'lucide-react'

import { formatBalanceCell } from '@/features/consolidated/model/consolidated.helpers'

type ConsolidatedSummaryCardProps = {
  label: string
  value: number
  tone: 'income' | 'expense' | 'balance'
  helper?: string
}

export function ConsolidatedSummaryCard({
  label,
  value,
  tone,
  helper,
}: ConsolidatedSummaryCardProps) {
  const isBalancePositive = tone === 'balance' && value > 0
  const isBalanceNegative = tone === 'balance' && value < 0

  const labelToneClass =
    tone === 'income' || isBalancePositive
      ? 'text-emerald-500'
      : tone === 'expense' || isBalanceNegative
        ? 'text-rose-500'
        : 'text-muted-foreground'
  const valueToneClass =
    tone === 'income' || isBalancePositive
      ? 'text-emerald-600'
      : tone === 'expense' || isBalanceNegative
        ? 'text-rose-600'
        : 'text-foreground'

  const ToneIcon =
    tone === 'income' ? ArrowUpRight : tone === 'expense' ? ArrowDownRight : Wallet

  return (
    <div className="flex items-center justify-between gap-4 rounded-md border px-4 py-3.5">
      <div>
        <p className="flex items-center gap-2 text-sm leading-5 text-muted-foreground">
          <ToneIcon className={`size-4 ${labelToneClass}`} />
          {label}
        </p>
        {helper ? <p className="mt-1 text-xs text-muted-foreground">{helper}</p> : null}
      </div>
      <p className={`text-lg font-semibold leading-6 ${valueToneClass}`}>
        {formatBalanceCell(value)}
      </p>
    </div>
  )
}
