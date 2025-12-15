export type User = {
  id: string
  name: string
}

let currentUser: User | null = null

export function getUser() {
  return currentUser
}

export function login() {
  currentUser = {
    id: "1",
    name: "Bruno",
  }
}

export function logout() {
  currentUser = null
}
