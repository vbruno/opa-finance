import { Link, useRouterState } from '@tanstack/react-router'
import clsx from 'clsx'
import { CreditCard, Home, Layers, Receipt } from 'lucide-react'
import { useEffect } from 'react'

const navItems = [
  { to: '/app/accounts', label: 'Contas', icon: CreditCard },
  { to: '/app/categories', label: 'Categorias', icon: Layers },
  { to: '/app/transactions', label: 'Transações', icon: Receipt },
]

const mobileNavItems = [
  { to: '/app', label: 'Dashboard', icon: Home },
  ...navItems,
]

type SidebarProps = {
  isOpen?: boolean
  onClose?: () => void
}

function SidebarNav({
  onNavigate,
  items = navItems,
}: {
  onNavigate?: () => void
  items?: typeof navItems
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
      <aside className="hidden w-64 border-r p-4 md:block">
        <SidebarNav />
      </aside>

      {isOpen ? (
        <div
          className="fixed inset-0 z-40 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menu de navegação"
        >
          <div
            className="fixed inset-0 bg-black/40 transition-opacity"
            onClick={onClose}
          />
          <aside className="relative h-full w-64 border-r bg-background p-4 shadow-lg transition-transform">
            <SidebarNav onNavigate={onClose} items={mobileNavItems} />
          </aside>
        </div>
      ) : null}
    </>
  )
}
