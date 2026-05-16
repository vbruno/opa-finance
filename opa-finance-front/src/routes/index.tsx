import { createFileRoute, redirect } from '@tanstack/react-router'

// Raiz delega a decisão de sessão para o gate único em `/app` (ATH-DEF-01).
// Quem está logado segue direto; quem não está cai no beforeLoad de `/app`,
// que tenta /auth/refresh e redireciona para /login se falhar. Evita duplicar
// a lógica de refresh aqui e garante comportamento correto em F5 após
// remoção do access token de localStorage (ATH-DEF-06).
export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: '/app' })
  },
})
