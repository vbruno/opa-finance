import { queryClient } from '@/lib/queryClient'

export type User = {
  id: string
  name: string
  email: string
  timezone?: string
  createdAt: string
}

const STORAGE_KEY_TOKEN = 'opa-finance:accessToken'
const STORAGE_KEY_USER = 'opa-finance:user'

let currentUser: User | null = loadUser()
let accessToken: string | null = loadToken()

const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((l) => l())
}

export function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getSnapshot() {
  return currentUser
}

function isValidToken(value: string | null): value is string {
  if (!value) return false
  const normalized = value.trim()
  return normalized.split('.').length === 3
}

function isValidUser(value: unknown): value is User {
  if (!value || typeof value !== 'object') return false
  const user = value as Partial<User>
  return (
    typeof user.id === 'string' &&
    user.id.length > 0 &&
    typeof user.name === 'string' &&
    user.name.length > 0 &&
    typeof user.email === 'string' &&
    user.email.length > 0 &&
    typeof user.createdAt === 'string'
  )
}

function loadToken(): string | null {
  const raw = localStorage.getItem(STORAGE_KEY_TOKEN)
  if (!isValidToken(raw)) {
    localStorage.removeItem(STORAGE_KEY_TOKEN)
    return null
  }
  return raw
}

function loadUser(): User | null {
  const raw = localStorage.getItem(STORAGE_KEY_USER)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!isValidUser(parsed)) {
      localStorage.removeItem(STORAGE_KEY_USER)
      return null
    }
    return parsed
  } catch {
    localStorage.removeItem(STORAGE_KEY_USER)
    return null
  }
}

function saveToken(token: string | null) {
  if (!token) {
    localStorage.removeItem(STORAGE_KEY_TOKEN)
  } else {
    localStorage.setItem(STORAGE_KEY_TOKEN, token)
  }
}

function saveUser(user: User | null) {
  if (!user) {
    localStorage.removeItem(STORAGE_KEY_USER)
  } else {
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user))
  }
}

export function getToken() {
  return accessToken
}

export function getUser() {
  return currentUser
}

export function setAuth(token: string, user: User) {
  if (!token || token.trim().length === 0 || !isValidUser(user)) {
    accessToken = null
    currentUser = null
    saveToken(null)
    saveUser(null)
    return
  }

  accessToken = token
  currentUser = user
  saveToken(token)
  saveUser(user)
  notify()
}

export function setAccessToken(token: string) {
  if (!isValidToken(token)) {
    accessToken = null
    saveToken(null)
    return
  }

  accessToken = token
  saveToken(token)
}

export function updateUser(user: User | null) {
  currentUser = user
  saveUser(user)
  notify()
}

export function logout() {
  accessToken = null
  currentUser = null
  saveToken(null)
  saveUser(null)
  queryClient.clear()
  notify()
}

export function isAuthenticated() {
  return !!accessToken && !!currentUser
}
