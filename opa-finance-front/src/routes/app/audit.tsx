import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useAuditLogs,
  type AuditAction,
  type AuditEntityType,
  type AuditLog,
} from '@/features/audit'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { getApiErrorMessage } from '@/lib/apiError'

const entityTypes: AuditEntityType[] = [
  'transaction',
  'account',
  'category',
  'subcategory',
]
const actions: AuditAction[] = ['create', 'update', 'delete']

export const Route = createFileRoute('/app/audit')({
  validateSearch: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    entityType: z
      .preprocess(
        (value) =>
          typeof value === 'string' &&
          entityTypes.includes(value as AuditEntityType)
            ? value
            : undefined,
        z.enum(entityTypes),
      )
      .optional(),
    action: z
      .preprocess(
        (value) =>
          typeof value === 'string' && actions.includes(value as AuditAction)
            ? value
            : undefined,
        z.enum(actions),
      )
      .optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }),
  component: AuditPage,
})

function AuditPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const isDesktop = useMediaQuery('(min-width: 960px)')

  const page = search.page ?? 1
  const limit = search.limit ?? 20

  const auditLogsQuery = useAuditLogs({
    page,
    limit,
    view: 'grouped',
    entityType: search.entityType,
    action: search.action,
    startDate: search.startDate || undefined,
    endDate: search.endDate || undefined,
  })

  const total = auditLogsQuery.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const selectedLogAccountName = selectedLog?.summary?.accountName ?? '-'

  useEffect(() => {
    if (!selectedLog) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setSelectedLog(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedLog])

  function setSearch(
    next: Partial<{
      page: number
      limit: number
      entityType: AuditEntityType | undefined
      action: AuditAction | undefined
      startDate: string | undefined
      endDate: string | undefined
    }>,
  ) {
    navigate({
      search: (prev) => ({
        ...prev,
        ...next,
      }),
    })
  }

  if (!isDesktop) {
    return (
      <div className="rounded-md border p-4">
        <h1 className="text-lg font-semibold">Histórico</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A visualização de auditoria está disponível na versão desktop.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Histórico</h1>
        <p className="text-sm text-muted-foreground">
          Lista simples de alterações. Use "Detalhes" para abrir mais
          informações.
        </p>
      </div>

      <div className="rounded-lg border p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">Filtros opcionais</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters((current) => !current)}
          >
            {showFilters ? 'Ocultar filtros' : 'Mostrar filtros'}
          </Button>
        </div>
        {showFilters ? (
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-5">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Entidade
              </label>
              <Select
                value={search.entityType ?? '__all__'}
                onValueChange={(value) =>
                  setSearch({
                    page: 1,
                    entityType:
                      value === '__all__'
                        ? undefined
                        : (value as AuditEntityType),
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas</SelectItem>
                  <SelectItem value="transaction">Transação</SelectItem>
                  <SelectItem value="account">Conta</SelectItem>
                  <SelectItem value="category">Categoria</SelectItem>
                  <SelectItem value="subcategory">Subcategoria</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Ação
              </label>
              <Select
                value={search.action ?? '__all__'}
                onValueChange={(value) =>
                  setSearch({
                    page: 1,
                    action:
                      value === '__all__' ? undefined : (value as AuditAction),
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas</SelectItem>
                  <SelectItem value="create">Criação</SelectItem>
                  <SelectItem value="update">Edição</SelectItem>
                  <SelectItem value="delete">Exclusão</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Data inicial
              </label>
              <Input
                type="date"
                value={search.startDate ?? ''}
                onChange={(event) =>
                  setSearch({
                    page: 1,
                    startDate: event.target.value || undefined,
                  })
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Data final
              </label>
              <Input
                type="date"
                value={search.endDate ?? ''}
                onChange={(event) =>
                  setSearch({
                    page: 1,
                    endDate: event.target.value || undefined,
                  })
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Limite
              </label>
              <Select
                value={String(limit)}
                onValueChange={(value) =>
                  setSearch({
                    page: 1,
                    limit: Number(value),
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="20" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : null}
      </div>

      {auditLogsQuery.isError ? (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400">
          {getApiErrorMessage(auditLogsQuery.error)}
        </div>
      ) : null}

      <div className="space-y-3">
        {auditLogsQuery.isLoading ? (
          <div className="rounded-md border p-4 text-sm text-muted-foreground">
            Carregando histórico...
          </div>
        ) : null}

        {!auditLogsQuery.isLoading &&
        (auditLogsQuery.data?.data.length ?? 0) === 0 ? (
          <div className="rounded-md border p-4 text-sm text-muted-foreground">
            Nenhum evento encontrado para os filtros informados.
          </div>
        ) : null}

        {auditLogsQuery.data?.data.length ? (
          <div className="overflow-hidden rounded-md border">
            <div className="grid grid-cols-[1fr_1fr_1.5fr_2fr_1.5fr] gap-2 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
              <span>Tela</span>
              <span>Tipo</span>
              <span>Conta</span>
              <span>Descrição</span>
              <span>Data/Hora</span>
            </div>
            {auditLogsQuery.data.data.map((log) => {
              const createdAt = new Date(log.createdAt)
              return (
                <article key={log.id} className="border-b last:border-b-0">
                  <div
                    className="grid cursor-pointer grid-cols-[1fr_1fr_1.5fr_2fr_1.5fr] gap-2 px-3 py-2 text-sm transition-colors hover:bg-muted/30"
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedLog(log)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setSelectedLog(log)
                      }
                    }}
                  >
                    <span>{screenLabel(log.entityType)}</span>
                    <span>
                      {log.summary?.action ?? actionLabel(log.action)}
                    </span>
                    <span className="truncate">
                      {log.summary?.accountName ?? '-'}
                    </span>
                    <span className="truncate">
                      {log.summary?.description ?? `ID ${log.entityId}`}
                    </span>
                    <span>{createdAt.toLocaleString('pt-BR')}</span>
                  </div>
                </article>
              )
            })}
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between rounded-md border p-3">
        <p className="text-xs text-muted-foreground">
          Página {page} de {totalPages} • {total} registros
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || auditLogsQuery.isLoading}
            onClick={() => setSearch({ page: page - 1 })}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || auditLogsQuery.isLoading}
            onClick={() => setSearch({ page: page + 1 })}
          >
            Próxima
          </Button>
        </div>
      </div>

      {selectedLog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="fixed inset-0" onClick={() => setSelectedLog(null)} />
          <div className="relative max-h-[85dvh] w-full max-w-2xl overflow-y-auto rounded-lg border bg-background p-3 shadow-lg sm:p-4">
            <div className="space-y-1">
              <h3 className="text-base font-semibold">Detalhes do log</h3>
              <p className="text-xs text-muted-foreground">
                Registro completo da alteração selecionada.
              </p>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <div className="rounded-md border px-3 py-2">
                <p className="text-xs text-muted-foreground">Tela</p>
                <p className="mt-0.5 font-medium">
                  {selectedLog.summary?.screen ??
                    screenLabel(selectedLog.entityType)}
                </p>
              </div>
              <div className="rounded-md border px-3 py-2">
                <p className="text-xs text-muted-foreground">Tipo</p>
                <p className="mt-0.5 font-medium">
                  {selectedLog.summary?.action ??
                    actionLabel(selectedLog.action)}
                </p>
              </div>
              <div className="rounded-md border px-3 py-2">
                <p className="text-xs text-muted-foreground">Conta</p>
                <p className="mt-0.5 font-medium">{selectedLogAccountName}</p>
              </div>
              <div className="rounded-md border px-3 py-2">
                <p className="text-xs text-muted-foreground">Data/Horário</p>
                <p className="mt-0.5 font-medium">
                  {new Date(selectedLog.createdAt).toLocaleString('pt-BR')}
                </p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2">
              <PreviewBlock
                title="Antes"
                data={selectedLog.beforeDataFriendly ?? selectedLog.beforeData}
              />
              <PreviewBlock
                title="Depois"
                data={selectedLog.afterDataFriendly ?? selectedLog.afterData}
              />
              <PreviewBlock
                title="Metadata"
                data={selectedLog.metadataFriendly ?? selectedLog.metadata}
              />
            </div>

            <div className="mt-3 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedLog(null)}
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function PreviewBlock({
  title,
  data,
}: {
  title: string
  data: Record<string, unknown> | null
}) {
  const fields = normalizePreviewData(data)

  return (
    <details className="rounded-md border p-1.5">
      <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
        {title}
      </summary>
      <div className="mt-1.5 max-h-36 space-y-1 overflow-auto text-[11px]">
        {fields.length === 0 ? (
          <p className="text-muted-foreground">Sem dados.</p>
        ) : (
          fields.map((field) => (
            <div key={field.key} className="grid grid-cols-[110px_1fr] gap-2">
              <span className="text-muted-foreground">{field.key}</span>
              <span className="break-words font-medium">{field.value}</span>
            </div>
          ))
        )}
      </div>
    </details>
  )
}

function actionLabel(action: AuditAction) {
  if (action === 'create') return 'Criação'
  if (action === 'update') return 'Edição'
  return 'Exclusão'
}

function screenLabel(entity: AuditEntityType) {
  if (entity === 'transaction') return 'Transações'
  if (entity === 'account') return 'Contas'
  if (entity === 'category') return 'Categorias'
  return 'Subcategorias'
}

function normalizePreviewData(data: Record<string, unknown> | null) {
  if (!data) {
    return [] as Array<{ key: string; value: string }>
  }

  return Object.entries(data).map(([key, value]) => ({
    key,
    value:
      value === null || value === undefined
        ? '-'
        : typeof value === 'string' ||
            typeof value === 'number' ||
            typeof value === 'boolean'
          ? String(value)
          : JSON.stringify(value),
  }))
}
