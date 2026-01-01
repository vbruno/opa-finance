import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import { getUser, logout } from '@/features/auth'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { Button } from '@/components/ui/button'

export function Header() {
  const navigate = useNavigate()
  const user = getUser()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  function handleLogout() {
    logout()
    navigate({ to: '/login' })
  }

  return (
    <header className="flex items-center justify-between border-b px-6 py-4">
      <h1 className="font-bold">Opa Finance</h1>

      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={() => setIsMenuOpen(true)}>
          {user?.name ?? 'Conta'}
        </Button>
        <ThemeToggle />
      </div>

      {isMenuOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="fixed inset-0" onClick={() => setIsMenuOpen(false)} />
          <div className="relative w-full max-w-sm rounded-lg border bg-background p-6 shadow-lg">
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsMenuOpen(false)
                  navigate({ to: '/app/profile' })
                }}
              >
                Ir para perfil
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setIsMenuOpen(false)
                  handleLogout()
                }}
              >
                Sair
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
