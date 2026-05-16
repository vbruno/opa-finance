import { z } from 'zod'

import { queryClient } from '@/lib/queryClient'

// Schema fonte da verdade do `User` cacheado em localStorage. Qualquer mudança
// (campo novo obrigatório, regra mais estrita) invalida automaticamente caches
// antigos via safeParse → forçando re-fetch de /auth/me no próximo beforeLoad.
export const userSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().min(1),
  timezone: z.string().optional(),
  createdAt: z.string().min(1),
})

export type User = z.infer<typeof userSchema>

const STORAGE_KEY_USER = 'opa-finance:user'

// Chave legada: antes de R2 (PE_auth_token_storage_hardening_front) o access
// token era persistido em localStorage. Hoje fica apenas em memória. Removemos
// a chave órfã uma vez no boot para limpar resíduo de sessões anteriores.
const LEGACY_STORAGE_KEY_TOKEN = 'opa-finance:accessToken'
if (typeof window !== 'undefined') {
  window.localStorage.removeItem(LEGACY_STORAGE_KEY_TOKEN)
}

// `accessToken` vive APENAS em memória — perdido em F5 por design.
// O `beforeLoad` de `/app` (gate único) chama `/auth/refresh` quando isso
// acontece, usando o cookie httpOnly como prova de sessão.
let currentUser: User | null = loadUser()
let accessToken: string | null = null

export type AuthSnapshot = {
  user: User | null
  isAuthenticated: boolean
}

// Snapshot referencialmente estável exigido por `useSyncExternalStore`.
// Recomputado APENAS dentro de `notify()` (antes de avisar os listeners) e
// retornado de `getSnapshot()` sem alocação nova. Mudar para "criar objeto
// novo a cada getSnapshot()" causaria warning do React e potencial loop.
let snapshot: AuthSnapshot = computeSnapshot()

function computeSnapshot(): AuthSnapshot {
  return {
    user: currentUser,
    isAuthenticated: Boolean(accessToken) && Boolean(currentUser),
  }
}

const listeners = new Set<() => void>()

function notify() {
  snapshot = computeSnapshot()
  listeners.forEach((l) => l())
}

export function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getSnapshot(): AuthSnapshot {
  return snapshot
}

function isValidToken(value: string | null): value is string {
  if (!value) return false
  const normalized = value.trim()
  return normalized.split('.').length === 3
}

function isValidUser(value: unknown): value is User {
  return userSchema.safeParse(value).success
}

function loadUser(): User | null {
  const raw = localStorage.getItem(STORAGE_KEY_USER)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as unknown
    const result = userSchema.safeParse(parsed)
    if (!result.success) {
      localStorage.removeItem(STORAGE_KEY_USER)
      return null
    }
    return result.data
  } catch {
    localStorage.removeItem(STORAGE_KEY_USER)
    return null
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
    saveUser(null)
    notify()
    return
  }

  accessToken = token
  currentUser = user
  saveUser(user)
  notify()
}

export function setAccessToken(token: string) {
  const next = isValidToken(token) ? token : null
  if (next === accessToken) {
    // Idempotente: mesmo valor não dispara notify nem re-render (ATH-DEF-08).
    return
  }
  accessToken = next
  notify()
}

export function updateUser(user: User | null) {
  currentUser = user
  saveUser(user)
  notify()
}

export function logout() {
  accessToken = null
  currentUser = null
  saveUser(null)
  queryClient.clear()
  notify()
}

export function isAuthenticated() {
  return !!accessToken && !!currentUser
}

// Sincronização entre abas (ATH-CNF-02 + revisão multi-conta).
// O evento `storage` dispara apenas em outras abas (não na que originou a
// mudança). O handler reage a qualquer mudança em STORAGE_KEY_USER:
//
//   - newValue === null (logout em outra aba):
//       zera memória + queryClient. Se esta aba está em /app/*, redireciona
//       para /login (sem aguardar a próxima request falhar com 401).
//
//   - newValue parseável e user.id IGUAL ao currentUser:
//       mesma conta, outros campos podem ter mudado. Atualiza currentUser
//       e notifica — sem redirect, sem disruptar a aba.
//
//   - newValue parseável e user.id DIFERENTE do currentUser:
//       outra conta entrou no browser. O cookie httpOnly de refresh também
//       foi trocado, então a sessão local (token em memória) é agora
//       inválida. Zera tudo e:
//         - se estava em /app/*, redireciona para /login (não pode misturar
//           identidades; usuário precisa reagir conscientemente).
//         - se estava em rota pública de auth (/login, /forgot-password,
//           /reset-password), vai para /app — onde o beforeLoad fará
//           /auth/refresh com o cookie novo e popula a sessão da nova conta.
//
// IMPORTANTE: NÃO reescrevemos localStorage aqui — a outra aba já fez essa
// parte. Isso evita cascata de eventos entre abas.
async function handleAuthStorageEvent(event: StorageEvent) {
  if (event.key !== STORAGE_KEY_USER) return

  const { router } = await import('@/router/router')
  const pathname = router.state.location.pathname
  const isInProtectedArea = pathname.startsWith('/app')
  const isInPublicAuthArea =
    pathname === '/login' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password'

  // Logout em outra aba.
  if (event.newValue === null) {
    accessToken = null
    currentUser = null
    queryClient.clear()
    notify()
    if (isInProtectedArea) {
      void router.navigate({ to: '/login' })
    }
    return
  }

  // Tenta parsear o novo user; descarta payloads inválidos silenciosamente.
  let parsed: unknown
  try {
    parsed = JSON.parse(event.newValue)
  } catch {
    return
  }
  const result = userSchema.safeParse(parsed)
  if (!result.success) return
  const newUser = result.data

  // Mesma conta — só refresh de campos cacheados.
  if (currentUser?.id === newUser.id) {
    currentUser = newUser
    notify()
    return
  }

  // Conta diferente entrou no browser (login novo OU troca de conta).
  accessToken = null
  currentUser = null
  queryClient.clear()
  notify()

  if (isInProtectedArea) {
    void router.navigate({ to: '/login' })
  } else if (isInPublicAuthArea) {
    void router.navigate({ to: '/app' })
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    void handleAuthStorageEvent(event)
  })
}
