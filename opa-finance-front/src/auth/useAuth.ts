import { getUser, login, logout } from "./auth.store"

export function useAuth() {
  return {
    user: getUser(),
    login,
    logout,
    isAuthenticated: !!getUser(),
  }
}
