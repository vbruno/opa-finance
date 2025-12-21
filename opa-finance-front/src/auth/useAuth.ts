import { getUser, logout, isAuthenticated } from './auth.store'

export function useAuth() {
  const user = getUser()

  return {
    user,
    logout,
    isAuthenticated: isAuthenticated(),
  }
}
