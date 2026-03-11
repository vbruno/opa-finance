import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import clsx from 'clsx'
import {
  BarChart3,
  CreditCard,
  Eye,
  EyeOff,
  History,
  Home,
  Layers,
  Moon,
  Receipt,
  Sun,
} from 'lucide-react'
import { useEffect } from 'react'

import { useTheme } from '@/components/theme/ThemeProvider'
import { Button } from '@/components/ui/button'
import { logout } from '@/features/auth'
import { useApiVersion } from '@/features/system'
import { APP_VERSION } from '@/generated/app-version'
import { useUserPreference } from '@/hooks/useUserPreference'

const appNavItems = [
  { to: '/app/accounts', label: 'Contas', icon: CreditCard },
  { to: '/app/categories', label: 'Categorias', icon: Layers },
  { to: '/app/transactions', label: 'Transações', icon: Receipt },
  { to: '/app/trial-balance', label: 'Balancete', icon: BarChart3 },
  { to: '/app/audit', label: 'Histórico', icon: History },
]

const desktopNavItems = [
  { to: '/app', label: 'Dashboard', icon: Home },
  ...appNavItems,
]

const mobileNavItems = [
  { to: '/app', label: 'Dashboard', icon: Home },
  ...appNavItems,
]

type SidebarProps = {
  isOpen?: boolean
  onClose?: () => void
}

function SidebarNav({
  onNavigate,
  items = desktopNavItems,
}: {
  onNavigate?: () => void
  items?: typeof appNavItems
}) {
  const { location } = useRouterState()

  return (
    <nav className="space-y-1">
      {items.map((item) => {
        const isActive = location.pathname === item.to

        const Icon = item.icon

        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={clsx(
              'flex items-center gap-2 rounded px-3 py-2 text-sm',
              isActive ? 'bg-muted font-medium' : 'hover:bg-muted/50',
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const { data: apiVersion } = useApiVersion()
  const isDark = theme === 'dark'
  const versionsLabel = `v${APP_VERSION} / ${apiVersion ? `v${apiVersion.version}` : 'API indisponível'}`
  const [isSensitiveHidden, setIsSensitiveHidden] = useUserPreference(
    'hideSensitive',
    false,
  )

  useEffect(() => {
    document.documentElement.classList.toggle(
      'hide-sensitive',
      isSensitiveHidden,
    )
  }, [isSensitiveHidden])

  function handleToggleSensitive() {
    const nextValue = !isSensitiveHidden
    setIsSensitiveHidden(nextValue)
  }

  function handleLogout() {
    logout()
    navigate({ to: '/login' })
  }

  useEffect(() => {
    if (!isOpen) {
      return
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose?.()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  return (
    <>
      <aside className="flex h-full w-64 shrink-0 overflow-y-auto border-r p-4 max-[959px]:hidden">
        <div className="flex h-full w-full flex-col">
          <SidebarNav />
          <div className="mt-auto border-t pt-4">
            <div className="space-y-2">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="flex-1"
                  onClick={toggleTheme}
                  aria-label={
                    isDark ? 'Ativar tema claro' : 'Ativar tema escuro'
                  }
                >
                  {isDark ? (
                    <Sun className="size-4" />
                  ) : (
                    <Moon className="size-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="flex-1"
                  aria-label={
                    isSensitiveHidden ? 'Mostrar valores' : 'Ocultar valores'
                  }
                  onClick={handleToggleSensitive}
                >
                  {isSensitiveHidden ? (
                    <Eye className="size-4" />
                  ) : (
                    <EyeOff className="size-4" />
                  )}
                </Button>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate({ to: '/app/profile' })}
              >
                Perfil
              </Button>
              <Button
                variant="destructive"
                className="w-full"
                onClick={handleLogout}
              >
                Sair
              </Button>
              <p className="pt-1 text-center text-xs text-muted-foreground">
                {versionsLabel}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {isOpen ? (
        <div
          className="fixed inset-0 z-40 min-[960px]:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menu de navegação"
        >
          <div
            className="fixed inset-0 bg-black/40 transition-opacity"
            onClick={onClose}
          />
          <aside className="relative h-full w-64 border-r bg-background p-4 shadow-lg transition-transform">
            <div className="flex h-full flex-col">
              <SidebarNav onNavigate={onClose} items={mobileNavItems} />
              <div className="mt-auto border-t pt-4">
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="flex-1"
                      onClick={toggleTheme}
                      aria-label={
                        isDark ? 'Ativar tema claro' : 'Ativar tema escuro'
                      }
                    >
                      {isDark ? (
                        <Sun className="size-4" />
                      ) : (
                        <Moon className="size-4" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="flex-1"
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
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      onClose?.()
                      navigate({ to: '/app/profile' })
                    }}
                  >
                    Perfil
                  </Button>
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => {
                      onClose?.()
                      handleLogout()
                    }}
                  >
                    Sair
                  </Button>
                  <p className="pt-1 text-center text-xs text-muted-foreground">
                    {versionsLabel}
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  )
}
