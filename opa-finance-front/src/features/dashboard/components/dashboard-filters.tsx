import type {
  ClipboardEventHandler,
  KeyboardEventHandler,
  MouseEventHandler,
} from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Account } from '@/features/accounts'
import { DASHBOARD_PERIOD_OPTIONS } from '@/features/dashboard/model/dashboard.constants'
import type { DashboardPeriod } from '@/features/dashboard/model/dashboard.constants'

type DashboardFiltersProps = {
  period: DashboardPeriod
  isAccountParamAll: boolean
  resolvedAccountId: string
  dashboardAccounts: Account[]
  customStartDate: string
  customEndDate: string
  startDate: string
  endDate: string
  isMobile: boolean
  onPeriodChange: (value: string) => void
  onAccountChange: (value: string) => void
  onCustomDateChange: (key: 'startDate' | 'endDate', value: string) => void
  onMobileDateClick: MouseEventHandler<HTMLInputElement>
  onMobileDateKeyDown: KeyboardEventHandler<HTMLInputElement>
  onMobileDatePaste: ClipboardEventHandler<HTMLInputElement>
}

export function DashboardFilters({
  period,
  isAccountParamAll,
  resolvedAccountId,
  dashboardAccounts,
  customStartDate,
  customEndDate,
  startDate,
  endDate,
  isMobile,
  onPeriodChange,
  onAccountChange,
  onCustomDateChange,
  onMobileDateClick,
  onMobileDateKeyDown,
  onMobileDatePaste,
}: DashboardFiltersProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-row sm:flex-wrap">
      <div className="col-span-1 space-y-1 sm:min-w-[180px] sm:flex-1">
        <Label htmlFor="period">Período</Label>
        <select
          id="period"
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          value={period}
          onChange={(event) => onPeriodChange(event.target.value)}
        >
          {DASHBOARD_PERIOD_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="col-span-1 space-y-1 sm:min-w-[200px] sm:flex-1">
        <Label htmlFor="account">Conta</Label>
        <select
          id="account"
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          value={isAccountParamAll ? 'all' : resolvedAccountId}
          onChange={(event) => onAccountChange(event.target.value)}
        >
          <option value="all">Todas as contas</option>
          {dashboardAccounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </div>

      {period === 'custom' && (
        <div className="col-span-2 grid grid-cols-2 gap-3 sm:flex sm:flex-row sm:flex-wrap">
          <div className="col-span-1 space-y-1 sm:min-w-[160px] sm:flex-1">
            <Label htmlFor="startDate">Início</Label>
            <Input
              id="startDate"
              type="date"
              value={customStartDate || startDate}
              inputMode={isMobile ? 'none' : undefined}
              onChange={(event) =>
                onCustomDateChange('startDate', event.target.value)
              }
              onClick={onMobileDateClick}
              onKeyDown={onMobileDateKeyDown}
              onPaste={onMobileDatePaste}
            />
          </div>
          <div className="col-span-1 space-y-1 sm:min-w-[160px] sm:flex-1">
            <Label htmlFor="endDate">Fim</Label>
            <Input
              id="endDate"
              type="date"
              value={customEndDate || endDate}
              inputMode={isMobile ? 'none' : undefined}
              onChange={(event) =>
                onCustomDateChange('endDate', event.target.value)
              }
              onClick={onMobileDateClick}
              onKeyDown={onMobileDateKeyDown}
              onPaste={onMobileDatePaste}
            />
          </div>
        </div>
      )}
    </div>
  )
}
