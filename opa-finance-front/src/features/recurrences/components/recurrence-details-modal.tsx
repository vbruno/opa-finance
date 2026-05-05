import { ArrowDown, ArrowUp, CheckCircle2, Pencil, SkipForward, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ShortcutTooltip } from '@/components/ui/shortcut-hint'
import { TablePagination } from '@/components/ui/table-pagination'
import type { Category } from '@/features/categories'
import type { Recurrence } from '@/features/recurrences'
import {
  useRecurrenceTimeline,
  useSkipRecurrenceOccurrence,
  type RecurrenceTimelineItem,
} from '@/features/recurrences'
import {
  formatIsoDateToPtBr,
  formatRecurrenceFrequency,
  formatRecurrenceOriginType,
  formatRecurrenceStatus,
  formatRecurrenceTimelineSource,
  formatRecurrenceTimelineStatus,
  getRecurrenceOperationalEndDate,
} from '@/features/recurrences/model/recurrences.helpers'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatCurrencyValue } from '@/lib/utils'

type RecurrenceDetailsModalProps = {
  recurrence: Recurrence | null
  accountsById: Map<string, { name: string }>
  categoriesById: Map<string, Category>
  onClose: () => void
  onEdit: (recurrence: Recurrence) => void
  onFinalize: (recurrence: Recurrence) => void
  onDelete: (recurrence: Recurrence) => void
  finalizePending?: boolean
  deletePending?: boolean
  errorMessage?: string | null
  onOpenConfirmOccurrence: (item: RecurrenceTimelineItem) => void
  onSkipOccurrence: (item: RecurrenceTimelineItem) => void
  onActionError: (message: string) => void
}

function formatMaybeIsoDate(value: string | null) {
  return value ? formatIsoDateToPtBr(value) : '-'
}

function formatMaybeText(value: string | null | undefined) {
  return value?.trim() ? value : 'Sem informação'
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-2 min-w-0">
      <dt className="text-[11px] text-muted-foreground/70 shrink-0">{label}</dt>
      <dd className="text-xs font-medium text-right truncate" title={value}>{value}</dd>
    </div>
  )
}

export function RecurrenceDetailsModal({
  recurrence,
  accountsById,
  categoriesById,
  onClose,
  onEdit,
  onFinalize,
  onDelete,
  finalizePending = false,
  deletePending = false,
  errorMessage,
  onOpenConfirmOccurrence,
  onSkipOccurrence,
  onActionError,
}: RecurrenceDetailsModalProps) {
  const modalRef = useRef<HTMLDivElement | null>(null)
  const [isBulkSkipping, setIsBulkSkipping] = useState(false)
  const [bulkSkipOpen, setBulkSkipOpen] = useState(false)
  const [bulkSkipReason, setBulkSkipReason] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)
  const [dir, setDir] = useState<'asc' | 'desc'>('asc')
  const skipMutation = useSkipRecurrenceOccurrence()
  const timelineParams = useMemo(() => {
    const operationalEndDate = recurrence
      ? getRecurrenceOperationalEndDate(recurrence)
      : null

    return {
      limit: pageSize,
      page,
      dir,
      untilDate: operationalEndDate ?? undefined,
      includeProjected: true,
    }
  }, [dir, page, pageSize, recurrence])
  const timelineQuery = useRecurrenceTimeline(recurrence?.id, timelineParams)

  useEffect(() => {
    if (!recurrence) return
    setPage(1)
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

  const pendingReviewItems = useMemo(
    () =>
      timelineQuery.data?.items.filter(
        (item) => item.status === 'pending_review' && item.canSkip && item.id && item.version !== null,
      ) ?? [],
    [timelineQuery.data?.items],
  )

  function handleSkipPendingReviewItems() {
    if (!recurrence || pendingReviewItems.length === 0) return
    setBulkSkipReason('')
    setBulkSkipOpen(true)
  }

  async function executeBulkSkip() {
    setBulkSkipOpen(false)
    setIsBulkSkipping(true)
    try {
      for (const item of pendingReviewItems) {
        await skipMutation.mutateAsync({
          occurrenceId: item.id as string,
          payload: {
            expectedVersion: item.version as number,
            reason: bulkSkipReason.trim() || undefined,
          },
        })
      }
    } catch (error) {
      onActionError(getApiErrorMessage(error))
    } finally {
      setIsBulkSkipping(false)
    }
  }

  if (!recurrence) {
    return null
  }

  const accountName = recurrence.accountId
    ? (accountsById.get(recurrence.accountId)?.name ?? recurrence.accountId)
    : '-'
  const fromAccountName = recurrence.fromAccountId
    ? (accountsById.get(recurrence.fromAccountId)?.name ?? recurrence.fromAccountId)
    : '-'
  const toAccountName = recurrence.toAccountId
    ? (accountsById.get(recurrence.toAccountId)?.name ?? recurrence.toAccountId)
    : '-'
  const categoryName = recurrence.categoryId
    ? (categoriesById.get(recurrence.categoryId)?.name ?? recurrence.categoryId)
    : '-'
  const subcategoryName = recurrence.subcategoryId
    ? (categoriesById.get(recurrence.subcategoryId)?.name ?? null)
    : null

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="recurrence-details-title"
        aria-describedby="recurrence-details-description"
        className="relative flex w-full max-w-5xl max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl sm:max-h-[calc(100dvh-2rem)]"
      >
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
          <h2 id="recurrence-details-title" className="text-base font-semibold sm:text-lg">
            Detalhes da recorrência
          </h2>
          <p id="recurrence-details-description" className="sr-only">
            Informações da regra, do modo de lançamento e da linha do tempo.
          </p>
          <div className="flex items-center gap-2 shrink-0">
            {recurrence.status === 'active' ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onEdit(recurrence)}
                  aria-label="Editar recorrência"
                >
                  <Pencil className="h-4 w-4" />
                  Editar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onFinalize(recurrence)}
                  disabled={finalizePending}
                >
                  {finalizePending ? 'Finalizando...' : 'Finalizar'}
                </Button>
              </>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => onDelete(recurrence)}
              disabled={deletePending}
              aria-label="Excluir recorrência"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {errorMessage ? (
          <div className="shrink-0 border-b px-4 py-2 sm:px-5">
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {errorMessage}
            </div>
          </div>
        ) : null}

        <div className="flex flex-1 min-h-0 flex-col gap-3 overflow-y-auto px-4 py-3 sm:px-5">
          <dl className="shrink-0 overflow-hidden rounded-2xl border bg-muted/20 divide-y">
            <div className="grid grid-cols-3 divide-x">
              <div className="col-span-2 flex items-center gap-3 px-3 py-2 min-w-0">
                <dt className="text-[11px] text-muted-foreground/70 shrink-0">Descrição</dt>
                <dd className="text-xs font-medium truncate" title={formatMaybeText(recurrence.description)}>
                  {formatMaybeText(recurrence.description)}
                </dd>
              </div>
              <MetaCell label="Status" value={formatRecurrenceStatus(recurrence.status)} />
            </div>
            <div className="grid grid-cols-3 divide-x">
              <MetaCell label="Modo de lançamento" value={recurrence.postingMode === 'automatic' ? 'Automático' : 'Com revisão'} />
              <MetaCell label="Origem" value={formatRecurrenceOriginType(recurrence.originType)} />
              <MetaCell label="Valor" value={formatCurrencyValue(recurrence.amount)} />
            </div>
            {recurrence.originType === 'transaction' ? (
              <div className="grid grid-cols-3 divide-x">
                <MetaCell label="Conta" value={accountName} />
                <div className="flex items-center justify-between gap-4 px-3 py-2 min-w-0">
                  <dt className="text-[11px] text-muted-foreground/70 shrink-0">Categoria</dt>
                  <dd className="text-xs font-medium text-right min-w-0">
                    <span className="block truncate" title={categoryName}>{categoryName}</span>
                    {subcategoryName ? (
                      <span className="block truncate text-muted-foreground/70" title={subcategoryName}>{subcategoryName}</span>
                    ) : null}
                  </dd>
                </div>
                <div aria-hidden="true" />
              </div>
            ) : (
              <div className="grid grid-cols-3 divide-x">
                <MetaCell label="De conta" value={fromAccountName} />
                <MetaCell label="Para conta" value={toAccountName} />
                <div aria-hidden="true" />
              </div>
            )}
            <div className="grid grid-cols-3 divide-x">
              <MetaCell label="Frequência" value={formatRecurrenceFrequency(recurrence.frequency)} />
              <MetaCell label="Próxima ocorrência" value={formatIsoDateToPtBr(recurrence.nextOccurrenceDate)} />
              <MetaCell label="Início" value={formatIsoDateToPtBr(recurrence.startDate)} />
            </div>
            <div className="grid grid-cols-3 divide-x">
              <MetaCell label="Última materialização" value={formatMaybeIsoDate(recurrence.lastMaterializedDate)} />
              <MetaCell label="Atualizada em" value={formatMaybeIsoDate(recurrence.updatedAt.slice(0, 10))} />
              <MetaCell label="Finalizada em" value={formatMaybeIsoDate(recurrence.finalizedAt?.slice(0, 10) ?? null)} />
            </div>
          </dl>

          <div className="flex flex-col flex-1 min-h-0 gap-2">

            {timelineQuery.isLoading ? (
              <div className="rounded-xl border p-3 text-sm text-muted-foreground">
                Carregando timeline da recorrência...
              </div>
            ) : timelineQuery.isError ? (
              <div className="space-y-2 rounded-xl border p-3 text-sm text-destructive">
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
              <div className="flex flex-col flex-1 min-h-0 gap-2">
              {pendingReviewItems.length > 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
                  <p>
                    Pendências em aberto bloqueiam finalizar ou excluir esta recorrência.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void handleSkipPendingReviewItems()}
                    disabled={isBulkSkipping}
                  >
                    {isBulkSkipping ? 'Ignorando...' : 'Ignorar em massa'}
                  </Button>
                </div>
              ) : null}

<div className="flex flex-col rounded-lg border flex-1 min-h-0 overflow-hidden">
              <div className="overflow-x-clip overflow-y-auto flex-1 min-h-0">
                <table
                  aria-label="Tabela de ocorrências da recorrência"
                  className="w-full text-sm"
                >
                  <thead className="sticky top-0 z-10 bg-muted text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th
                        className="px-3 py-2 cursor-pointer select-none hover:text-foreground"
                        onClick={() => { setDir(d => d === 'asc' ? 'desc' : 'asc'); setPage(1) }}
                      >
                        <span className="flex items-center gap-1">
                          Data
                          {dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                        </span>
                      </th>
                      <th className="px-3 py-1.5">Recorrência</th>
                      <th className="px-3 py-1.5">Status</th>
                      <th className="px-3 py-1.5">Origem</th>
                      <th className="px-3 py-1.5 text-right">Valor</th>
                      <th className="px-3 py-1.5">Vínculo</th>
                      <th className="px-3 py-1.5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timelineQuery.data?.items.map((item) => (
                      <tr key={`${item.source}-${item.id ?? item.occurrenceDate}`} className="border-t">
                        <td className="px-3 py-1.5 font-medium whitespace-nowrap">
                          {formatIsoDateToPtBr(item.occurrenceDate)}
                        </td>
                        <td className="px-3 py-1.5 whitespace-nowrap tabular-nums">
                          {item.sequence
                            ? timelineQuery.data?.summary.totalOccurrences
                              ? `${item.sequence} / ${timelineQuery.data.summary.totalOccurrences}`
                              : `${item.sequence}`
                            : '-'}
                        </td>
                        <td className="px-3 py-1.5">
                          {formatRecurrenceTimelineStatus(item.status)}
                        </td>
                        <td className="px-3 py-1.5">
                          {formatRecurrenceTimelineSource(item.source)}
                        </td>
                        <td className="px-3 py-1.5 text-right font-medium whitespace-nowrap">
                          {formatCurrencyValue(item.amount)}
                        </td>
                        <td className="px-3 py-1.5">
                          {item.transactionId
                            ? `Transação ${item.transactionId}`
                            : item.transferId
                              ? `Transferência ${item.transferId}`
                              : 'Projetada'}
                        </td>
                        <td className="px-3 py-1.5">
                          <div className="flex justify-end gap-1">
                            <ShortcutTooltip
                              label={item.canConfirm ? 'Confirmar' : 'Sem ação de confirmação'}
                              className="w-auto"
                            >
                              <Button
                                type="button"
                                size="icon-sm"
                                variant="outline"
                                className="disabled:opacity-40"
                                onClick={() => onOpenConfirmOccurrence(item)}
                                disabled={!item.canConfirm}
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
                    ))}
                  </tbody>
                </table>

                {timelineQuery.data?.items.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">
                    Nenhuma ocorrência encontrada para a janela consultada.
                  </div>
                ) : null}
              </div>

              {timelineQuery.data ? (
                <TablePagination
                  page={page}
                  totalPages={timelineQuery.data.pagination.total
                    ? Math.ceil(timelineQuery.data.pagination.total / pageSize)
                    : null}
                  hasMore={timelineQuery.data.pagination.hasMore}
                  onPageChange={setPage}
                  pageSize={pageSize}
                  onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
                  pageSizeOptions={[12, 24, 48]}
                  isLoading={timelineQuery.isFetching}
                  className="shrink-0 bg-transparent"
                />
              ) : null}
            </div>
            </div>
            )}
          </div>
        </div>
      </div>
    </div>

    <AlertDialog open={bulkSkipOpen} onOpenChange={(open) => { if (!open) setBulkSkipOpen(false) }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Ignorar {pendingReviewItems.length} pendência(s)</AlertDialogTitle>
          <AlertDialogDescription>
            Elas continuarão consumindo a posição da recorrência.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="bulk-skip-reason">Motivo (opcional)</Label>
          <Input
            id="bulk-skip-reason"
            placeholder="Ex.: lançamentos fora do período"
            value={bulkSkipReason}
            onChange={(e) => setBulkSkipReason(e.target.value)}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => void executeBulkSkip()}>
            Ignorar todas
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
