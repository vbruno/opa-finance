import {
  getIanaTimezones,
  normalizeSearch,
} from '@/lib/timezones'

import type { ProfileTimezoneCatalogInput } from './profile.types'

export function formatProfileCreatedAt(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

export function getLocalTimezoneOptions() {
  return getIanaTimezones()
}

export function resolveProfileTimezoneOptions({
  apiOptions,
  localOptions,
}: ProfileTimezoneCatalogInput) {
  if (Array.isArray(apiOptions) && apiOptions.length > 0) {
    return apiOptions
  }
  return localOptions
}

export function filterProfileTimezoneOptions(options: string[], search: string) {
  const normalizedSearch = normalizeSearch(search)
  if (!normalizedSearch) {
    return options
  }

  return options.filter((timezone) =>
    normalizeSearch(timezone).includes(normalizedSearch),
  )
}

export function buildProfileTimezoneOptionsForSelect({
  filteredOptions,
  currentTimezone,
}: {
  filteredOptions: string[]
  currentTimezone: string
}) {
  if (!currentTimezone) {
    return filteredOptions
  }
  const merged = filteredOptions.includes(currentTimezone)
    ? filteredOptions
    : [currentTimezone, ...filteredOptions]
  return Array.from(new Set(merged))
}
