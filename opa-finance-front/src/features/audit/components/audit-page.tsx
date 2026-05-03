import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { TablePagination } from '@/components/ui/table-pagination'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAccounts } from '@/features/accounts'
import {
  useAuditLogs,
  type AuditAction,
  type AuditEntityType,
  type AuditLog,
} from '@/features/audit'
import { AuditDetailModal } from '@/features/audit/components/audit-detail-modal'
import { useAuditSearchParams } from '@/features/audit/hooks/use-audit-search-params'
import { resolveAuditAccountLabel } from '@/features/audit/mappers/audit-log.mapper'
import {
  actionLabel,
  screenLabel,
} from '@/features/audit/model/audit.helpers'
import type {
  AuditNavigateFn,
  AuditSearchParams,
} from '@/features/audit/model/audit.types'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { getApiErrorMessage } from '@/lib/apiError'

type AuditPageProps = {
  search: AuditSearchParams
  navigate: AuditNavigateFn
}

export function AuditPage({ search, navigate }: AuditPageProps) {
  const isDesktop = useMediaQuery('(min-width: 960px)')

  const { page, limit, setSearch } = useAuditSearchParams({ search, navigate })

  const accountsQuery = useAccounts()
  const accountNameById = useMemo(
    () =>
      new Map(
        (accountsQuery.data ?? []).map((account) => [account.id, account.name]),
      ),
    [accountsQuery.data],
  )

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
  const selectedLogAccountName = selectedLog
    ? resolveAuditAccountLabel(selectedLog, accountNameById)
    : '-'

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
          Lista simples de alterações. Use "Detalhes" para abrir mais informações.
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
                      value === '__all__' ? undefined : (value as AuditEntityType),
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
                    action: value === '__all__' ? undefined : (value as AuditAction),
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
                    <span>{log.summary?.action ?? actionLabel(log.action)}</span>
                    <span className="truncate">
                      {resolveAuditAccountLabel(log, accountNameById)}
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

      <TablePagination
        page={page}
        totalPages={totalPages}
        hasMore={page < totalPages}
        onPageChange={(p) => setSearch({ page: p })}
        pageSize={limit}
        onPageSizeChange={(size) => setSearch({ limit: size, page: 1 })}
        totalRecords={total}
        isLoading={auditLogsQuery.isLoading}
      />

      {selectedLog ? (
        <AuditDetailModal
          selectedLog={selectedLog}
          selectedLogAccountName={selectedLogAccountName}
          onClose={() => setSelectedLog(null)}
        />
      ) : null}
    </div>
  )
}
