import { useEffect, useMemo, useState } from 'react'

import { useAuth } from '@/features/auth/useAuth'

// eslint-disable-next-line no-unused-vars
type Serialize<T> = (value: T) => string
// eslint-disable-next-line no-unused-vars
type Deserialize<T> = (raw: string) => T

type PreferenceOptions<T> = {
  serialize?: Serialize<T>
  deserialize?: Deserialize<T>
}

const defaultSerialize = <T,>(value: T) => JSON.stringify(value)
const defaultDeserialize = <T,>(raw: string) => JSON.parse(raw) as T

function readPreference<T>(
  storageKey: string | null,
  defaultValue: T,
  deserialize: Deserialize<T>,
) {
  if (!storageKey) {
    return defaultValue
  }
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) {
      return defaultValue
    }
    return deserialize(raw)
  } catch {
    return defaultValue
  }
}

export function useUserPreference<T>(
  key: string,
  defaultValue: T,
  options: PreferenceOptions<T> = {},
) {
  const { user } = useAuth()
  const serialize = options.serialize ?? defaultSerialize
  const deserialize = options.deserialize ?? defaultDeserialize

  const storageKey = useMemo(() => {
    if (!user?.id) {
      return null
    }
    return `opa-finance:pref:${user.id}:${key}`
  }, [key, user?.id])

  const [value, setValue] = useState<T>(() =>
    readPreference(storageKey, defaultValue, deserialize),
  )

  useEffect(() => {
    setValue(readPreference(storageKey, defaultValue, deserialize))
  }, [defaultValue, deserialize, storageKey])

  useEffect(() => {
    if (!storageKey) {
      return
    }
    try {
      localStorage.setItem(storageKey, serialize(value))
    } catch {
      // ignore localStorage errors
    }
  }, [serialize, storageKey, value])

  return [value, setValue] as const
}
