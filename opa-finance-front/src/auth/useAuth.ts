import { getUser, login, logout } from './auth.store'

export function useAuth() {
  const user = getUser()

  return {
    user,
    login,
    logout,
    isAuthenticated: !!user,
  }
}
