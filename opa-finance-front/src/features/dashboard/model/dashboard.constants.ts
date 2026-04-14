export const DASHBOARD_PERIOD_VALUES = [
  'month',
  'previousMonth',
  'last7',
  'last15',
  'last30',
  'custom',
] as const

export const DASHBOARD_PRESET_PERIOD_VALUES = [
  'month',
  'previousMonth',
  'last7',
  'last15',
  'last30',
] as const

export const DASHBOARD_PERIOD_OPTIONS = [
  { value: 'month', label: 'Mês atual' },
  { value: 'previousMonth', label: 'Mês anterior' },
  { value: 'last7', label: 'Últimos 7 dias' },
  { value: 'last15', label: 'Últimos 15 dias' },
  { value: 'last30', label: 'Últimos 30 dias' },
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
