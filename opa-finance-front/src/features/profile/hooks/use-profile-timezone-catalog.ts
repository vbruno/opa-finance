import { useMemo } from 'react'

import { useUserTimezones } from '@/features/profile/profile.api'
import { getBrowserTimezone } from '@/lib/timezones'

import {
  buildProfileTimezoneOptionsForSelect,
  filterProfileTimezoneOptions,
  getLocalTimezoneOptions,
  resolveProfileTimezoneOptions,
} from '../model/profile.helpers'

type UseProfileTimezoneCatalogInput = {
  enabled: boolean
  search: string
  currentTimezone: string
}

export function useProfileTimezoneCatalog({
  enabled,
  search,
  currentTimezone,
}: UseProfileTimezoneCatalogInput) {
  const browserTimezone = useMemo(() => getBrowserTimezone(), [])
  const localTimezoneOptions = useMemo(() => getLocalTimezoneOptions(), [])

  const userTimezonesQuery = useUserTimezones({ enabled })

  const timezoneOptions = useMemo(
    () =>
      resolveProfileTimezoneOptions({
        apiOptions: userTimezonesQuery.data,
        localOptions: localTimezoneOptions,
      }),
    [localTimezoneOptions, userTimezonesQuery.data],
  )

  const filteredTimezoneOptions = useMemo(
    () => filterProfileTimezoneOptions(timezoneOptions, search),
    [search, timezoneOptions],
  )

  const timezoneOptionsForSelect = useMemo(
    () =>
      buildProfileTimezoneOptionsForSelect({
        filteredOptions: filteredTimezoneOptions,
        currentTimezone,
      }),
    [currentTimezone, filteredTimezoneOptions],
  )

  return {
    browserTimezone,
    userTimezonesQuery,
    filteredTimezoneOptions,
    timezoneOptionsForSelect,
  }
}
