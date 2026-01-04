import { Link, useRouterState } from '@tanstack/react-router'
import clsx from 'clsx'
import { CreditCard, Layers, Receipt } from 'lucide-react'

const navItems = [
  { to: '/app/accounts', label: 'Contas', icon: CreditCard },
  { to: '/app/categories', label: 'Categorias', icon: Layers },
  { to: '/app/transactions', label: 'Transações', icon: Receipt },
]

export function Sidebar() {
  const { location } = useRouterState()

  return (
    <aside className="w-64 border-r p-4">
      <nav className="space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to

          const Icon = item.icon

          return (
            <Link
              key={item.to}
              to={item.to}
              className={clsx(
                'flex items-center gap-2 rounded px-3 py-2 text-sm',
                isActive
                  ? 'bg-muted font-medium'
                  : 'hover:bg-muted/50',
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
