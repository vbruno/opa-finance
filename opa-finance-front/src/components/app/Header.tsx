import { Link, useNavigate } from '@tanstack/react-router'
import { Eye, EyeOff, Menu } from 'lucide-react'
import { useEffect, useState } from 'react'

import { getUser, logout } from '@/features/auth'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { Button } from '@/components/ui/button'

type HeaderProps = {
  onMenuClick?: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
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
    <header className="flex items-center justify-between border-b px-4 py-3 sm:px-6 sm:py-4">
      <div className="flex items-center gap-2">
        {onMenuClick ? (
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            aria-label="Abrir menu"
            onClick={onMenuClick}
          >
            <Menu className="size-4" />
          </Button>
        ) : null}
        <Link to="/app" className="hidden font-bold md:inline-flex">
          Opa Finance
        </Link>
        <Button
          type="button"
          variant="ghost"
          className="p-0 font-bold text-foreground hover:bg-transparent md:hidden"
          onClick={onMenuClick}
        >
          Opa Finance
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <span className="text-sm font-medium text-muted-foreground md:hidden">
          {user?.name ?? 'Conta'}
        </span>
        <div className="hidden items-center gap-2 sm:gap-3 md:flex">
          <Button
            variant="outline"
            onClick={() => setIsMenuOpen(true)}
            className="h-8 px-3 text-xs sm:h-9 sm:px-4 sm:text-sm"
          >
            {user?.name ?? 'Conta'}
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={
              isSensitiveHidden
                ? 'Mostrar valores'
                : 'Ocultar valores'
            }
            onClick={handleToggleSensitive}
            className="h-8 w-8 sm:h-9 sm:w-9"
          >
            {isSensitiveHidden ? (
              <Eye className="size-4" />
            ) : (
              <EyeOff className="size-4" />
            )}
          </Button>
          <ThemeToggle />
        </div>
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
