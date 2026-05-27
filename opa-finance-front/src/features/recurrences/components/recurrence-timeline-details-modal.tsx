import { useNavigate } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import type { Category } from '@/features/categories'
import type { Recurrence, RecurrenceTimelineItem } from '@/features/recurrences'
import {
  formatIsoDateToPtBr,
  formatRecurrenceTimelineStatus,
} from '@/features/recurrences/model/recurrences.helpers'
import { formatCurrencyValue } from '@/lib/utils'

type RecurrenceTimelineDetailsModalProps = {
  item: RecurrenceTimelineItem | null
  recurrence: Recurrence
  totalOccurrences: number | null
  accountsById: Map<string, { name: string }>
  categoriesById: Map<string, Category>
  isBulkSkipping: boolean
  isOpeningConfirmModal: boolean
  onClose: () => void
  onEditOccurrence?: (item: RecurrenceTimelineItem) => void
  onConfirmOccurrence: (item: RecurrenceTimelineItem) => void
  onSkipOccurrence: (item: RecurrenceTimelineItem) => void
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  )
}

function OccurrenceSubtitle({
  status,
}: {
  status: RecurrenceTimelineItem['status']
}) {
  const text =
    status === 'materialized'
      ? 'Ocorrência já lançada como transação real.'
      : status === 'pending_review'
        ? 'Aguarda revisão antes de ser lançada.'
        : status === 'projected'
          ? 'Ainda não foi lançada — valores previstos da regra.'
          : status === 'skipped'
            ? 'Esta ocorrência foi ignorada.'
            : 'Não foi possível lançar esta ocorrência.'
  return <p className="text-sm text-muted-foreground">{text}</p>
}

type OccurrenceActionsProps = {
  item: RecurrenceTimelineItem
  recurrence: Recurrence
  isBulkSkipping: boolean
  isOpeningConfirmModal: boolean
  onEditOccurrence?: (item: RecurrenceTimelineItem) => void
  onConfirmOccurrence: (item: RecurrenceTimelineItem) => void
  onSkipOccurrence: (item: RecurrenceTimelineItem) => void
  onOpenTransaction?: (item: RecurrenceTimelineItem) => void
}

function OccurrenceActions({
  item,
  recurrence,
  isBulkSkipping,
  isOpeningConfirmModal,
  onEditOccurrence,
  onConfirmOccurrence,
  onSkipOccurrence,
  onOpenTransaction,
}: OccurrenceActionsProps) {
  const canEdit =
    Boolean(onEditOccurrence) &&
    recurrence.status === 'active' &&
    (item.status === 'projected' || item.status === 'pending_review')

  const canOpenTransaction =
    item.status === 'materialized' &&
    Boolean(item.transactionId || item.transferId)

  const hasAnyAction =
    canEdit || item.canConfirm || item.canSkip || canOpenTransaction
  if (!hasAnyAction) return null

  return (
    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
      {canOpenTransaction && onOpenTransaction ? (
        <Button
          variant="outline"
          className="w-full sm:w-auto"
          onClick={() => onOpenTransaction(item)}
        >
          Abrir transação
        </Button>
      ) : null}
      {canEdit && onEditOccurrence ? (
        <Button
          variant="outline"
          className="w-full sm:w-auto"
          onClick={() => onEditOccurrence(item)}
          disabled={isBulkSkipping}
        >
          Editar
        </Button>
      ) : null}
      {item.canConfirm ? (
        <Button
          variant="outline"
          className="w-full sm:w-auto"
          onClick={() => onConfirmOccurrence(item)}
          disabled={isOpeningConfirmModal}
        >
          Confirmar
        </Button>
      ) : null}
      {item.canSkip ? (
        <Button
          variant="outline"
          className="w-full sm:w-auto"
          onClick={() => onSkipOccurrence(item)}
          disabled={isBulkSkipping}
        >
          Ignorar
        </Button>
      ) : null}
    </div>
  )
}

function resolveAccountName(
  accountId: string | null,
  accountsById: Map<string, { name: string }>,
): string {
  if (!accountId) return '-'
  return accountsById.get(accountId)?.name ?? accountId
}

function resolveCategoryLabel(
  categoryId: string | null,
  categoriesById: Map<string, Category>,
): string {
  if (!categoryId) return '-'
  return categoriesById.get(categoryId)?.name ?? categoryId
}

function resolveCategoryType(
  categoryId: string | null,
  categoriesById: Map<string, Category>,
): string {
  if (!categoryId) return '-'
  const category = categoriesById.get(categoryId)
  if (!category) return '-'
  return category.type === 'income' ? 'Receita' : 'Despesa'
}

export function RecurrenceTimelineDetailsModal({
  item,
  recurrence,
  totalOccurrences,
  accountsById,
  categoriesById,
  isBulkSkipping,
  isOpeningConfirmModal,
  onClose,
  onEditOccurrence,
  onConfirmOccurrence,
  onSkipOccurrence,
}: RecurrenceTimelineDetailsModalProps) {
  const modalRef = useRef<HTMLDivElement | null>(null)
  const navigate = useNavigate()

  const handleOpenTransaction = (target: RecurrenceTimelineItem) => {
    if (target.transactionId) {
      void navigate({
        to: '/app/transactions',
        search: { editId: target.transactionId },
      })
    } else if (target.transferId) {
      void navigate({
        to: '/app/transactions',
        search: { editTransferId: target.transferId },
      })
    }
  }

  useEffect(() => {
    if (!item) return
    const id = window.setTimeout(() => {
      modalRef.current?.focus()
    }, 0)
    return () => window.clearTimeout(id)
  }, [item])

  if (!item) return null

  const sequenceLabel = item.sequence
    ? totalOccurrences
      ? `${item.sequence} / ${totalOccurrences}`
      : `${item.sequence}`
    : '-'

  const isTransfer = recurrence.originType === 'transfer'
  const description = recurrence.description?.trim() || 'Sem descrição'
  const notes = recurrence.notes?.trim() || 'Sem notas'
  const link = item.transactionId
    ? 'Transação'
    : item.transferId
      ? 'Transferência'
      : null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="recurrence-timeline-details-title"
        className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-lg border bg-background p-4 shadow-lg sm:p-6"
      >
        <div className="space-y-1">
          <h3
            id="recurrence-timeline-details-title"
            className="text-lg font-semibold"
          >
            Detalhes da ocorrência
          </h3>
          <OccurrenceSubtitle status={item.status} />
        </div>

        <div className="mt-6 grid gap-4 text-sm">
          <DetailRow
            label="Data"
            value={formatIsoDateToPtBr(item.occurrenceDate)}
          />
          <DetailRow label="Sequência" value={sequenceLabel} />
          <DetailRow
            label="Status"
            value={formatRecurrenceTimelineStatus(item.status)}
          />
          {isTransfer ? (
            <>
              <DetailRow
                label="De conta"
                value={resolveAccountName(recurrence.fromAccountId, accountsById)}
              />
              <DetailRow
                label="Para conta"
                value={resolveAccountName(recurrence.toAccountId, accountsById)}
              />
            </>
          ) : (
            <>
              <DetailRow
                label="Conta"
                value={resolveAccountName(recurrence.accountId, accountsById)}
              />
              <DetailRow
                label="Categoria"
                value={resolveCategoryLabel(recurrence.categoryId, categoriesById)}
              />
              {recurrence.subcategoryId ? (
                <DetailRow
                  label="Subcategoria"
                  value={recurrence.subcategoryName?.trim() || '-'}
                />
              ) : null}
              <DetailRow
                label="Tipo"
                value={resolveCategoryType(recurrence.categoryId, categoriesById)}
              />
            </>
          )}
          <DetailRow
            label="Valor"
            value={
              <span className="inline-flex items-center gap-1.5">
                {item.hasOverride ? (
                  <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                    Ajustada
                  </span>
                ) : null}
                <span className="font-semibold">
                  {formatCurrencyValue(item.amount)}
                </span>
              </span>
            }
          />
          <DetailRow label="Descrição" value={description} />
          <DetailRow label="Notas" value={notes} />
          {link ? <DetailRow label="Vínculo" value={link} /> : null}
        </div>

        <OccurrenceActions
          item={item}
          recurrence={recurrence}
          isBulkSkipping={isBulkSkipping}
          isOpeningConfirmModal={isOpeningConfirmModal}
          onEditOccurrence={onEditOccurrence}
          onConfirmOccurrence={onConfirmOccurrence}
          onSkipOccurrence={onSkipOccurrence}
          onOpenTransaction={handleOpenTransaction}
        />
      </div>
    </div>
  )
}
