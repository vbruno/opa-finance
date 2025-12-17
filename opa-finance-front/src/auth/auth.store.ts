export type User = {
  id: string
  name: string
}

const STORAGE_KEY = 'opa-finance:user'

let currentUser: User | null = loadUser()

function loadUser(): User | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function saveUser(user: User | null) {
  if (!user) {
    localStorage.removeItem(STORAGE_KEY)
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
  }
}

export function getUser() {
  return currentUser
}

export function login() {
  currentUser = {
    id: '1',
    name: 'Bruno',
  }
  saveUser(currentUser)
}

export function logout() {
  currentUser = null
  saveUser(null)
}
