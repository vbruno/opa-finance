import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { TablePagination } from '@/components/ui/table-pagination'
import type { Category } from '@/features/categories'
import type { Recurrence } from '@/features/recurrences'
import {
  formatIsoDateToPtBr,
  formatRecurrenceFrequency,
  formatRecurrenceOriginType,
  formatRecurrenceStatus,
  formatRecurrenceTarget,
} from '@/features/recurrences/model/recurrences.helpers'

type RecurrencesListProps = {
  recurrences: Recurrence[]
  page: number
  total: number
  totalPages: number
  isLoading: boolean
  isError: boolean
  errorMessage?: string
  finalizePending: boolean
  deletePending: boolean
  accountsById: Map<string, { name: string }>
  categoriesById: Map<string, Category>
  onRetry: () => void
  onOpenCreateModal: () => void
  onOpenDetails: (recurrence: Recurrence) => void
  onOpenEditModal: (recurrence: Recurrence) => void
  onFinalize: (recurrence: Recurrence) => void
  onDelete: (recurrence: Recurrence) => void
  onPageChange: (page: number) => void
}

export function RecurrencesList({
  recurrences,
  page,
  total,
  totalPages,
  isLoading,
  isError,
  errorMessage,
  finalizePending,
  deletePending,
  accountsById,
  categoriesById,
  onRetry,
  onOpenCreateModal,
  onOpenDetails,
  onOpenEditModal,
  onFinalize,
  onDelete,
  onPageChange,
}: RecurrencesListProps) {
  const hasRecurrences = recurrences.length > 0

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border">
      <div className="flex-1 overflow-x-auto">
        <div className="grid grid-cols-[1.3fr_0.9fr_0.9fr_1.2fr_0.9fr_0.7fr] gap-2 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
          <span>Descrição</span>
          <span>Origem</span>
          <span>Frequência</span>
          <span>Conta/Categoria</span>
          <span>Próxima</span>
          <span>Status</span>
        </div>

        {isLoading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={`recurrence-skeleton-${index}`}
                className="h-10 animate-pulse rounded bg-muted/40"
              />
            ))}
          </div>
        ) : null}

        {isError ? (
          <div className="space-y-2 p-4 text-sm text-red-300">
            <p>{errorMessage ?? 'Erro ao carregar recorrências.'}</p>
            <Button size="sm" variant="outline" onClick={onRetry}>
              Tentar novamente
            </Button>
          </div>
        ) : null}

        {!isLoading && !isError && recurrences.length === 0 ? (
          <div className="space-y-2 p-4 text-sm text-muted-foreground">
            <p>Nenhuma recorrência encontrada para os filtros informados.</p>
            <Button size="sm" variant="outline" onClick={onOpenCreateModal}>
              <Plus className="mr-2 size-4" />
              Criar recorrência
            </Button>
          </div>
        ) : null}

        {hasRecurrences
          ? recurrences.map((recurrence) => (
              <div
                key={recurrence.id}
                role="button"
                tabIndex={0}
                onClick={() => onOpenDetails(recurrence)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpenDetails(recurrence) }}
                className="grid grid-cols-[1.3fr_0.9fr_0.9fr_1.2fr_0.9fr_0.7fr] items-center gap-2 border-b px-3 py-2 text-sm last:border-b-0 cursor-pointer hover:bg-muted/40 transition-colors"
              >
                <div className="truncate">
                  {recurrence.description || recurrence.notes || 'Sem descrição'}
                  {recurrence.pendingReviewCount && recurrence.pendingReviewCount > 0 ? (
                    <span className="ml-2 inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-100">
                      {recurrence.pendingReviewCount} pendência
                      {recurrence.pendingReviewCount > 1 ? 's' : ''}
                    </span>
                  ) : null}
                </div>
                <div>{formatRecurrenceOriginType(recurrence.originType)}</div>
                <div>{formatRecurrenceFrequency(recurrence.frequency)}</div>
                <div className="truncate">
                  {formatRecurrenceTarget(recurrence, accountsById, categoriesById)}
                </div>
                <div>{formatIsoDateToPtBr(recurrence.nextOccurrenceDate)}</div>
                <div>{formatRecurrenceStatus(recurrence.status)}</div>
              </div>
            ))
          : null}
      </div>

      {!isLoading && !isError && hasRecurrences ? (
        <TablePagination
          page={page}
          totalPages={totalPages}
          hasMore={page < totalPages}
          onPageChange={onPageChange}
          totalRecords={total}
        />
      ) : null}
    </div>
  )
}
