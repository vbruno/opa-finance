import type { RefObject } from 'react'

import { Button } from '@/components/ui/button'
import { ShortcutLabel, ShortcutTooltip } from '@/components/ui/shortcut-hint'
import type { Account } from '@/features/accounts'
import { formatCurrencyValue } from '@/lib/utils'

type AccountDetailsModalProps = {
  account: Account | null
  isEditOpen: boolean
  detailModalRef: RefObject<HTMLDivElement | null>
  accountTypeLabels: Record<string, string>
  dateFormatter: Intl.DateTimeFormat
  isTogglingDashboardVisibility: boolean
  dashboardVisibilityError: string | null
  deleteError: string | null
  onClose: () => void
  onToggleDashboardVisibility: () => void
  onOpenDeleteConfirm: () => void
  onOpenEdit: () => void
}

export function AccountDetailsModal({
  account,
  isEditOpen,
  detailModalRef,
  accountTypeLabels,
  dateFormatter,
  isTogglingDashboardVisibility,
  dashboardVisibilityError,
  deleteError,
  onClose,
  onToggleDashboardVisibility,
  onOpenDeleteConfirm,
  onOpenEdit,
}: AccountDetailsModalProps) {
  if (!account || isEditOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="fixed inset-0" onClick={onClose} />
      <div
        className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-lg border bg-background p-4 shadow-lg sm:max-h-none sm:overflow-visible sm:p-6"
        ref={detailModalRef}
        tabIndex={-1}
      >
        <div className="space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-semibold">{account.name}</h3>
            <div className="flex flex-wrap items-center gap-2">
              {account.isPrimary && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                  Principal
                </span>
              )}
              {account.isHiddenOnDashboard && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                  Oculta no dashboard
                </span>
              )}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Detalhes da conta</p>
        </div>

        <div className="mt-6 grid gap-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground">Tipo</span>
            <span className="font-medium">
              {accountTypeLabels[account.type] ?? account.type}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground">Saldo atual</span>
            <span className="sensitive font-semibold">
              {`$ ${formatCurrencyValue(account.currentBalance ?? 0)}`}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground">Criada em</span>
            <span className="font-medium">
              {dateFormatter.format(new Date(account.createdAt))}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground">Dashboard</span>
            <span className="font-medium">
              {account.isHiddenOnDashboard ? 'Oculta' : 'Visível'}
            </span>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full sm:w-auto">
            <ShortcutTooltip
              label={account.isHiddenOnDashboard ? 'Atalho: M' : 'Atalho: O'}
            >
              <Button
                variant={account.isHiddenOnDashboard ? 'default' : 'secondary'}
                className="w-full sm:w-auto"
                onClick={onToggleDashboardVisibility}
                disabled={isTogglingDashboardVisibility || account.isPrimary}
              >
                {isTogglingDashboardVisibility ? (
                  'Salvando...'
                ) : account.isHiddenOnDashboard ? (
                  <ShortcutLabel label="Mostrar" shortcutIndex={0} />
                ) : (
                  <ShortcutLabel label="Ocultar" shortcutIndex={0} />
                )}
              </Button>
            </ShortcutTooltip>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <ShortcutTooltip label="Atalho: R">
              <Button
                variant="destructive"
                className="w-full sm:w-auto"
                onClick={onOpenDeleteConfirm}
              >
                <ShortcutLabel label="Excluir" shortcutIndex={6} />
              </Button>
            </ShortcutTooltip>
            <ShortcutTooltip label="Atalho: E">
              <Button variant="outline" className="w-full sm:w-auto" onClick={onOpenEdit}>
                <ShortcutLabel label="Editar" shortcutIndex={0} />
              </Button>
            </ShortcutTooltip>
          </div>
        </div>
        {deleteError && (
          <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {deleteError}
          </div>
        )}
        {dashboardVisibilityError && (
          <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {dashboardVisibilityError}
          </div>
        )}
      </div>
    </div>
  )
}
