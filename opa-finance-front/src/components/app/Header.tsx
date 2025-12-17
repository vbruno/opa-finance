import { useNavigate } from '@tanstack/react-router'

import { logout } from '@/auth/auth.store'
import { Button } from '@/components/ui/button'

export function Header() {
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate({ to: '/login' })
  }

  return (
    <header className="flex items-center justify-between border-b px-6 py-4">
      <h1 className="font-bold">Opa Finance</h1>

      <Button variant="outline" onClick={handleLogout}>
        Sair
      </Button>
    </header>
  )
}
