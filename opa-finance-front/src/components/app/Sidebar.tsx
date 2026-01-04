import { Link, useRouterState } from '@tanstack/react-router'
import clsx from 'clsx'

const navItems = [
  { to: '/app/accounts', label: 'Contas' },
  { to: '/app/categories', label: 'Categorias' },
  { to: '/app/transactions', label: 'Transacoes' },
]

export function Sidebar() {
  const { location } = useRouterState()

  return (
    <aside className="w-64 border-r p-4">
      <nav className="space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to

          return (
            <Link
              key={item.to}
              to={item.to}
              className={clsx(
                'block rounded px-3 py-2 text-sm',
                isActive
                  ? 'bg-muted font-medium'
                  : 'hover:bg-muted/50',
              )}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
