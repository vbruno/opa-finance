import { useSyncExternalStore } from 'react'

import { getSnapshot, subscribe, logout, isAuthenticated } from './auth.store'

export function useAuth() {
  const user = useSyncExternalStore(subscribe, getSnapshot)

  return {
    user,
    logout,
    isAuthenticated: isAuthenticated(),
  }
}
