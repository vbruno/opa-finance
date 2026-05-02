import { useEffect, useMemo, useRef } from 'react'

import { Button } from '@/components/ui/button'
import type { Category } from '@/features/categories'
import type { Recurrence } from '@/features/recurrences'
import { useRecurrenceTimeline, type RecurrenceTimelineItem } from '@/features/recurrences'
import {
  formatIsoDateToPtBr,
  formatRecurrenceFrequency,
  formatRecurrenceOriginType,
  formatRecurrenceStatus,
  formatRecurrenceTarget,
  formatRecurrenceTimelineSource,
  formatRecurrenceTimelineStatus,
} from '@/features/recurrences/model/recurrences.helpers'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatCurrencyValue } from '@/lib/utils'

type RecurrenceDetailsModalProps = {
  recurrence: Recurrence | null
  accountsById: Map<string, { name: string }>
  categoriesById: Map<string, Category>
  onClose: () => void
  onOpenConfirmOccurrence: (item: RecurrenceTimelineItem) => void
  onSkipOccurrence: (item: RecurrenceTimelineItem) => void
}

function formatMaybeIsoDate(value: string | null) {
  return value ? formatIsoDateToPtBr(value) : '-'
}

function formatMaybeText(value: string | null | undefined) {
  return value?.trim() ? value : 'Sem informação'
}

export function RecurrenceDetailsModal({
  recurrence,
  accountsById,
  categoriesById,
  onClose,
  onOpenConfirmOccurrence,
  onSkipOccurrence,
}: RecurrenceDetailsModalProps) {
  const modalRef = useRef<HTMLDivElement | null>(null)
  const timelineQuery = useRecurrenceTimeline(recurrence?.id, {
    limit: 24,
    includeProjected: true,
  })

  useEffect(() => {
    if (!recurrence) return
    const id = window.setTimeout(() => {
      modalRef.current?.focus()
    }, 0)
    return () => window.clearTimeout(id)
  }, [recurrence])

  useEffect(() => {
    if (!recurrence) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, recurrence])

  const summaryCards = useMemo(() => {
    const summary = timelineQuery.data?.summary
    if (!summary) return []

    return [
      ['Consumidas', summary.consumedOccurrences.toString()],
      ['Lançadas', summary.materializedOccurrences.toString()],
      ['Pendentes', summary.pendingReviewOccurrences.toString()],
      ['Ignoradas', summary.skippedOccurrences.toString()],
      ['Falhas', summary.failedOccurrences.toString()],
      ['Projetadas', summary.projectedOccurrences.toString()],
    ] as const
  }, [timelineQuery.data?.summary])

  if (!recurrence) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="recurrence-details-title"
        aria-describedby="recurrence-details-description"
        className="relative w-full max-w-4xl max-h-[90dvh] overflow-y-auto rounded-lg border bg-background p-4 shadow-lg sm:max-h-none sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 id="recurrence-details-title" className="text-lg font-semibold">
              Detalhes da recorrência
            </h2>
            <p id="recurrence-details-description" className="text-sm text-muted-foreground">
              Informações da regra, do modo de lançamento e da linha do tempo.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Fechar
          </Button>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Descrição
            </p>
            <p className="mt-1 font-medium">
              {formatMaybeText(recurrence.description)}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Status
            </p>
            <p className="mt-1 font-medium">{formatRecurrenceStatus(recurrence.status)}</p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Modo de lançamento
            </p>
            <p className="mt-1 font-medium">
              {recurrence.postingMode === 'automatic' ? 'Automático' : 'Com revisão'}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Valor
            </p>
            <p className="mt-1 font-medium">{formatCurrencyValue(recurrence.amount)}</p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Origem
            </p>
            <p className="mt-1 font-medium">
              {formatRecurrenceOriginType(recurrence.originType)}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Frequência
            </p>
            <p className="mt-1 font-medium">
              {formatRecurrenceFrequency(recurrence.frequency)}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Conta / categoria
            </p>
            <p className="mt-1 font-medium">
              {formatRecurrenceTarget(recurrence, accountsById, categoriesById)}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Próxima ocorrência
            </p>
            <p className="mt-1 font-medium">
              {formatIsoDateToPtBr(recurrence.nextOccurrenceDate)}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Início
            </p>
            <p className="mt-1 font-medium">{formatIsoDateToPtBr(recurrence.startDate)}</p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Última materialização
            </p>
            <p className="mt-1 font-medium">
              {formatMaybeIsoDate(recurrence.lastMaterializedDate)}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Finalizada em
            </p>
            <p className="mt-1 font-medium">
              {formatMaybeIsoDate(recurrence.finalizedAt?.slice(0, 10) ?? null)}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Atualizada em
            </p>
            <p className="mt-1 font-medium">
              {formatMaybeIsoDate(recurrence.updatedAt.slice(0, 10))}
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold">Linha do tempo</h3>
              <p className="text-sm text-muted-foreground">
                Últimas ocorrências persistidas e projeções calculadas.
              </p>
            </div>
            {timelineQuery.data?.summary.projectionWindowLabel ? (
              <span className="rounded-md border bg-muted/20 px-2 py-1 text-xs text-muted-foreground">
                {timelineQuery.data.summary.projectionWindowLabel}
              </span>
            ) : null}
          </div>

          {timelineQuery.isLoading ? (
            <div className="rounded-lg border p-4 text-sm text-muted-foreground">
              Carregando timeline da recorrência...
            </div>
          ) : timelineQuery.isError ? (
            <div className="space-y-3 rounded-lg border p-4 text-sm text-destructive">
              <p>{getApiErrorMessage(timelineQuery.error)}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void timelineQuery.refetch()}
              >
                Tentar novamente
              </Button>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {summaryCards.map(([label, value]) => (
                  <div key={label} className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {label}
                    </p>
                    <p className="mt-1 text-lg font-semibold">{value}</p>
                  </div>
                ))}
                <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Total estimado
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {timelineQuery.data?.summary.totalAmount === null
                      ? 'Parcial'
                      : formatCurrencyValue(timelineQuery.data?.summary.totalAmount ?? 0)}
                  </p>
                </div>
              </div>

              {timelineQuery.data?.summary.isPartial ? (
                <p className="text-sm text-muted-foreground">
                  Exibindo uma janela parcial da recorrência.
                </p>
              ) : null}

              <div className="overflow-x-auto rounded-lg border">
                <table
                  aria-label="Tabela de ocorrências da recorrência"
                  className="min-w-[920px] w-full text-sm"
                >
                  <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Data</th>
                      <th className="px-4 py-3">Parcela</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Origem</th>
                      <th className="px-4 py-3 text-right">Valor</th>
                      <th className="px-4 py-3">Vínculo</th>
                      <th className="px-4 py-3">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timelineQuery.data?.items.map((item) => (
                      <tr key={`${item.source}-${item.id ?? item.occurrenceDate}`} className="border-t align-top">
                        <td className="px-4 py-3 font-medium">
                          {formatIsoDateToPtBr(item.occurrenceDate)}
                        </td>
                        <td className="px-4 py-3">
                          {item.sequence ? `Parcela ${item.sequence}` : '-'}
                        </td>
                        <td className="px-4 py-3">
                          {formatRecurrenceTimelineStatus(item.status)}
                        </td>
                        <td className="px-4 py-3">
                          {formatRecurrenceTimelineSource(item.source)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          {formatCurrencyValue(item.amount)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <p>
                              {item.transactionId
                                ? `Transação ${item.transactionId}`
                                : item.transferId
                                  ? `Transferência ${item.transferId}`
                                  : 'Projetada'}
                            </p>
                            {item.source === 'persisted' && item.id ? (
                              <p className="text-xs text-muted-foreground">ID {item.id}</p>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            {item.canConfirm ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => onOpenConfirmOccurrence(item)}
                              >
                                Confirmar
                              </Button>
                            ) : (
                              <span className="rounded-full border px-2 py-1">
                                Sem ação de confirmação
                              </span>
                            )}
                            {item.canSkip ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => onSkipOccurrence(item)}
                              >
                                Ignorar
                              </Button>
                            ) : (
                              <span className="rounded-full border px-2 py-1">
                                Sem ação de ignorar
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {timelineQuery.data?.items.length === 0 ? (
                <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                  Nenhuma ocorrência encontrada para a janela consultada.
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
