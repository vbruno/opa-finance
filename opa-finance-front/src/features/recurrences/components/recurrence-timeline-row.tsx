import { CheckCircle2, Pencil, SkipForward } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ShortcutTooltip } from '@/components/ui/shortcut-hint'
import type { Recurrence, RecurrenceTimelineItem } from '@/features/recurrences'
import {
  formatIsoDateToPtBr,
  formatRecurrenceTimelineStatus,
} from '@/features/recurrences/model/recurrences.helpers'
import { formatCurrencyValue } from '@/lib/utils'

type RecurrenceTimelineRowProps = {
  item: RecurrenceTimelineItem
  recurrence: Recurrence
  totalOccurrences: number | null
  isBulkSkipping: boolean
  isOpeningConfirmModal: boolean
  onRowClick: (item: RecurrenceTimelineItem) => void
  onEditOccurrence?: (item: RecurrenceTimelineItem) => void
  onConfirmOccurrence: (item: RecurrenceTimelineItem) => void
  onSkipOccurrence: (item: RecurrenceTimelineItem) => void
}

export function RecurrenceTimelineRow({
  item,
  recurrence,
  totalOccurrences,
  isBulkSkipping,
  isOpeningConfirmModal,
  onRowClick,
  onEditOccurrence,
  onConfirmOccurrence,
  onSkipOccurrence,
}: RecurrenceTimelineRowProps) {
  const canEdit =
    Boolean(onEditOccurrence) &&
    recurrence.status === 'active' &&
    (item.status === 'projected' || item.status === 'pending_review')

  const sequenceLabel = item.sequence
    ? totalOccurrences
      ? `${item.sequence} / ${totalOccurrences}`
      : `${item.sequence}`
    : '-'

  return (
    <tr
      className="border-t cursor-pointer hover:bg-muted/30 focus:outline-none focus:bg-muted/40"
      onClick={() => onRowClick(item)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onRowClick(item)
        }
      }}
      tabIndex={0}
      aria-label={`Ver detalhes da ocorrência de ${formatIsoDateToPtBr(item.occurrenceDate)}`}
    >
      <td className="px-3 py-1.5 font-medium whitespace-nowrap">
        {formatIsoDateToPtBr(item.occurrenceDate)}
      </td>
      <td className="px-3 py-1.5 whitespace-nowrap tabular-nums">
        {sequenceLabel}
      </td>
      <td className="px-3 py-1.5 text-right font-medium whitespace-nowrap">
        <span className="inline-flex items-center justify-end gap-1.5">
          {item.hasOverride ? (
            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
              Ajustada
            </span>
          ) : null}
          {formatCurrencyValue(item.amount)}
        </span>
      </td>
      <td className="px-3 py-1.5">
        {formatRecurrenceTimelineStatus(item.status)}
      </td>
      <td
        className="px-3 py-1.5"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <div className="flex justify-end gap-1">
          {canEdit && onEditOccurrence ? (
            <ShortcutTooltip label="Editar ocorrência" className="w-auto">
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                onClick={() => onEditOccurrence(item)}
                disabled={isBulkSkipping}
                aria-label="Editar ocorrência"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </ShortcutTooltip>
          ) : null}
          <ShortcutTooltip
            label={item.canConfirm ? 'Confirmar' : 'Sem ação de confirmação'}
            className="w-auto"
          >
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              className="disabled:opacity-40"
              onClick={() => onConfirmOccurrence(item)}
              disabled={!item.canConfirm || isOpeningConfirmModal}
              aria-label="Confirmar ocorrência"
            >
              <CheckCircle2 className="h-4 w-4" />
            </Button>
          </ShortcutTooltip>
          <ShortcutTooltip
            label={item.canSkip ? 'Ignorar' : 'Sem ação de ignorar'}
            className="w-auto"
          >
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              className="disabled:opacity-40"
              onClick={() => onSkipOccurrence(item)}
              disabled={!item.canSkip}
              aria-label="Ignorar ocorrência"
            >
              <SkipForward className="h-4 w-4" />
            </Button>
          </ShortcutTooltip>
        </div>
      </td>
    </tr>
  )
}
