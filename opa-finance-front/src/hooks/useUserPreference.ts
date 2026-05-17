import { useEffect, useMemo, useRef, useState } from 'react'

import { useAuth } from '@/features/auth/useAuth'

type Serialize<T> = (value: T) => string
type Deserialize<T> = (raw: string) => T

type PreferenceOptions<T> = {
  serialize?: Serialize<T>
  deserialize?: Deserialize<T>
}

const defaultSerialize = <T>(value: T) => JSON.stringify(value)
const defaultDeserialize = <T>(raw: string) => JSON.parse(raw) as T

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

  // Mantém refs estáveis para serialize/deserialize. Chamadores podem passar
  // funções inline (referência nova a cada render); usar diretamente como
  // dependência de useEffect faria o effect rodar a cada render e oscilar o
  // valor armazenado.
  const serializeRef = useRef(serialize)
  const deserializeRef = useRef(deserialize)
  serializeRef.current = serialize
  deserializeRef.current = deserialize

  const storageKey = useMemo(() => {
    if (!user?.id) {
      return null
    }
    return `opa-finance:pref:${user.id}:${key}`
  }, [key, user?.id])

  const [value, setValue] = useState<T>(() =>
    readPreference(storageKey, defaultValue, deserializeRef.current),
  )

  useEffect(() => {
    setValue(readPreference(storageKey, defaultValue, deserializeRef.current))
  }, [defaultValue, storageKey])

  useEffect(() => {
    if (!storageKey) {
      return
    }
    try {
      localStorage.setItem(storageKey, serializeRef.current(value))
    } catch {
      // ignore localStorage errors
    }
  }, [storageKey, value])

  return [value, setValue] as const
}
