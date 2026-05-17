export const DASHBOARD_PERIOD_VALUES = [
  'month',
  'currentYear',
  'fiscalYear',
  'previousMonth',
  'last7',
  'last15',
  'last30',
  'custom',
] as const

export const DASHBOARD_PRESET_PERIOD_VALUES = [
  'month',
  'currentYear',
  'fiscalYear',
  'previousMonth',
  'last7',
  'last15',
  'last30',
] as const

export const DASHBOARD_PERIOD_OPTIONS = [
  { value: 'month', label: 'Mês Corrente' },
  { value: 'previousMonth', label: 'Mês Anterior' },
  { value: 'currentYear', label: 'Ano Corrente' },
  { value: 'fiscalYear', label: 'Ano Fiscal' },
  { value: 'custom', label: 'Customizado' },
] as const

export function isDashboardPeriod(value: string): value is DashboardPeriod {
  return DASHBOARD_PERIOD_VALUES.includes(value as DashboardPeriod)
}

export function isDashboardPresetPeriod(
  value: string,
): value is DashboardPresetPeriod {
  return DASHBOARD_PRESET_PERIOD_VALUES.includes(value as DashboardPresetPeriod)
}

export type DashboardPeriod = (typeof DASHBOARD_PERIOD_VALUES)[number]
export type DashboardPresetPeriod =
  (typeof DASHBOARD_PRESET_PERIOD_VALUES)[number]
