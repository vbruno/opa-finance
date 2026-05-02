import { Eye, Pencil, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
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
  onPrevPage: () => void
  onNextPage: () => void
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
  onPrevPage,
  onNextPage,
}: RecurrencesListProps) {
  const hasRecurrences = recurrences.length > 0

  return (
    <>
      <div className="overflow-hidden rounded-md border">
        <div className="grid grid-cols-[1.3fr_0.9fr_0.9fr_1.2fr_0.9fr_0.7fr_1fr] gap-2 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
          <span>Descrição</span>
          <span>Origem</span>
          <span>Frequência</span>
          <span>Conta/Categoria</span>
          <span>Próxima</span>
          <span>Status</span>
          <span className="text-right">Ações</span>
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
                className="grid grid-cols-[1.3fr_0.9fr_0.9fr_1.2fr_0.9fr_0.7fr_1fr] items-center gap-2 border-b px-3 py-2 text-sm last:border-b-0"
              >
                <div className="truncate">
                  {recurrence.description || recurrence.notes || 'Sem descrição'}
                </div>
                <div>{formatRecurrenceOriginType(recurrence.originType)}</div>
                <div>{formatRecurrenceFrequency(recurrence.frequency)}</div>
                <div className="truncate">
                  {formatRecurrenceTarget(recurrence, accountsById, categoriesById)}
                </div>
                <div>{formatIsoDateToPtBr(recurrence.nextOccurrenceDate)}</div>
                <div>{formatRecurrenceStatus(recurrence.status)}</div>
                <div className="flex justify-end gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onOpenDetails(recurrence)}
                    aria-label={`Ver detalhes da recorrência ${recurrence.description ?? recurrence.id}`}
                  >
                    <Eye className="size-4" />
                    <span>Ver detalhes</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onOpenEditModal(recurrence)}
                    disabled={recurrence.status !== 'active'}
                    aria-label={`Editar recorrência ${recurrence.description ?? recurrence.id}`}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  {recurrence.status === 'active' ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onFinalize(recurrence)}
                        disabled={finalizePending}
                        aria-label={`Finalizar recorrência ${recurrence.description ?? recurrence.id}`}
                      >
                        Finalizar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => onDelete(recurrence)}
                        aria-label={`Excluir recorrência ativa ${recurrence.description ?? recurrence.id}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => onDelete(recurrence)}
                      disabled={deletePending}
                      aria-label={`Excluir recorrência ${recurrence.description ?? recurrence.id}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          : null}
      </div>

      {!isLoading && !isError && hasRecurrences ? (
        <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm text-muted-foreground">
          <span>
            Página {page} de {totalPages} · {total} registros
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={onPrevPage}>
              Anterior
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={onNextPage}
            >
              Próxima
            </Button>
          </div>
        </div>
      ) : null}
    </>
  )
}
