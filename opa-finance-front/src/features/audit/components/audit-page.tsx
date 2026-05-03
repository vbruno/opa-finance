import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TablePagination } from '@/components/ui/table-pagination'
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
    <div className="flex h-full flex-col gap-4">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold">Histórico</h1>
      </div>

      <div className="shrink-0 rounded-lg border p-3">
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
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
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

          </div>
        ) : null}
      </div>

      {auditLogsQuery.isError ? (
        <div className="shrink-0 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400">
          {getApiErrorMessage(auditLogsQuery.error)}
        </div>
      ) : null}

      <div className="flex flex-col flex-1 min-h-0 overflow-hidden rounded-lg border">
        <div className="overflow-y-auto flex-1 min-h-0">
          <table
            aria-label="Tabela de histórico de alterações"
            className="w-full text-sm"
          >
            <thead className="sticky top-0 z-10 bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Tela</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Conta</th>
                <th className="px-3 py-2">Descrição</th>
                <th className="px-3 py-2">Data/Hora</th>
              </tr>
            </thead>
            <tbody>
              {auditLogsQuery.data?.data.map((log) => {
                const createdAt = new Date(log.createdAt)
                return (
                  <tr
                    key={log.id}
                    className="border-t cursor-pointer transition-colors hover:bg-muted/30"
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
                    <td className="px-3 py-1.5 whitespace-nowrap">{screenLabel(log.entityType)}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{log.summary?.action ?? actionLabel(log.action)}</td>
                    <td className="px-3 py-1.5 max-w-[180px] truncate">{resolveAuditAccountLabel(log, accountNameById)}</td>
                    <td className="px-3 py-1.5 max-w-[240px] truncate">{log.summary?.description ?? `ID ${log.entityId}`}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{createdAt.toLocaleString('pt-BR')}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {auditLogsQuery.isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">
              Carregando histórico...
            </div>
          ) : !auditLogsQuery.isLoading && (auditLogsQuery.data?.data.length ?? 0) === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">
              Nenhum evento encontrado para os filtros informados.
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
          className="shrink-0 bg-transparent"
        />
      </div>

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
