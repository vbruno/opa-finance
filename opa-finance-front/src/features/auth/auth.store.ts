export type User = {
  id: string
  name: string
  email: string
  createdAt: string
}

const STORAGE_KEY_TOKEN = 'opa-finance:accessToken'
const STORAGE_KEY_USER = 'opa-finance:user'

let currentUser: User | null = loadUser()
let accessToken: string | null = loadToken()

function loadToken(): string | null {
  return localStorage.getItem(STORAGE_KEY_TOKEN)
}

function loadUser(): User | null {
  const raw = localStorage.getItem(STORAGE_KEY_USER)
  if (!raw) return null

  try {
    return JSON.parse(raw)
  } catch {
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
  accessToken = token
  currentUser = user
  saveToken(token)
  saveUser(user)
}

export function updateUser(user: User | null) {
  currentUser = user
  saveUser(user)
}

export function logout() {
  accessToken = null
  currentUser = null
  saveToken(null)
  saveUser(null)
}

export function isAuthenticated() {
  return !!accessToken && !!currentUser
}
