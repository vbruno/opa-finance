import { useSyncExternalStore } from 'react'

import { getSnapshot, logout, subscribe } from './auth.store'

// Consumir `user`/`isAuthenticated` fora de `/app/*` pode produzir flicker
// no boot: o store hidrata `currentUser` a partir de localStorage antes do
// `beforeLoad` em `/app/route.tsx` revalidar via `/auth/refresh` + `/auth/me`.
// Dentro de `/app/*` esse problema não existe porque o `beforeLoad` bloqueia
// o render até a revalidação terminar (ATH-DEF-07). Se algum dia um
// componente público precisar do user logado, considerar introduzir uma
// flag `isHydrated` no store e segurar o render até ela ficar `true`.
export function useAuth() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  return {
    user: snap.user,
    logout,
    isAuthenticated: snap.isAuthenticated,
  }
}
