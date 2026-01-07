import { Link, useNavigate } from '@tanstack/react-router'
import { Eye, EyeOff } from 'lucide-react'
import { useEffect, useState } from 'react'

import { getUser, logout } from '@/features/auth'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { Button } from '@/components/ui/button'

export function Header() {
  const navigate = useNavigate()
  const user = getUser()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isSensitiveHidden, setIsSensitiveHidden] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    const stored = localStorage.getItem('opa-finance:hideSensitive')
    const shouldHide = stored === 'true'
    setIsSensitiveHidden(shouldHide)
    document.documentElement.classList.toggle(
      'hide-sensitive',
      shouldHide,
    )
  }, [])

  function handleToggleSensitive() {
    const nextValue = !isSensitiveHidden
    setIsSensitiveHidden(nextValue)
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        'opa-finance:hideSensitive',
        nextValue ? 'true' : 'false',
      )
    }
    document.documentElement.classList.toggle(
      'hide-sensitive',
      nextValue,
    )
  }

  function handleLogout() {
    logout()
    navigate({ to: '/login' })
  }

  return (
    <header className="flex items-center justify-between border-b px-6 py-4">
      <Link to="/app" className="font-bold">
        Opa Finance
      </Link>

      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={() => setIsMenuOpen(true)}>
          {user?.name ?? 'Conta'}
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label={
            isSensitiveHidden
              ? 'Mostrar valores'
              : 'Ocultar valores'
          }
          onClick={handleToggleSensitive}
        >
          {isSensitiveHidden ? (
            <Eye className="size-4" />
          ) : (
            <EyeOff className="size-4" />
          )}
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
