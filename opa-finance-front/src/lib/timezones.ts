const DEFAULT_TIMEZONE = 'Australia/Adelaide'

const FALLBACK_TIMEZONES = [
  DEFAULT_TIMEZONE,
  'UTC',
  'America/Sao_Paulo',
  'America/New_York',
  'Europe/London',
]

export function getIanaTimezones() {
  const supportedValuesOf = (Intl as unknown as { supportedValuesOf?: Function })
    .supportedValuesOf

  if (typeof supportedValuesOf === 'function') {
    const list = (supportedValuesOf as any)('timeZone')
    const normalizedList = Array.isArray(list) ? (list as string[]) : []
    const sortedList = normalizedList
      .filter((timezone) => timezone && timezone.includes('/'))
      .sort((a, b) => a.localeCompare(b))
    if (sortedList.length > 0) {
      return sortedList
    }
  }

  const currentTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const merged = new Set(FALLBACK_TIMEZONES)
  if (currentTimezone) {
    merged.add(currentTimezone)
  }
  return Array.from(merged).sort((a, b) => a.localeCompare(b))
}

export function normalizeSearch(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function getBrowserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE
}

export function getTimezoneDisplayLabel(timezone: string) {
  const city = timezone.split('/').pop()?.replace(/_/g, ' ') || timezone
  const offset = getTimezoneOffsetLabel(timezone)
  return `${city} (${offset}) · ${timezone}`
}

function getTimezoneOffsetLabel(timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date())

    const tzPart = parts.find((part) => part.type === 'timeZoneName')?.value
    if (!tzPart) return 'UTC'

    return tzPart.replace('GMT', 'UTC')
  } catch {
    return 'UTC'
  }
}

export { DEFAULT_TIMEZONE }
