import { Link } from '@tanstack/react-router'
import { Menu } from 'lucide-react'

import { getUser } from '@/features/auth'
import { Button } from '@/components/ui/button'

type HeaderProps = {
  onMenuClick?: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const user = getUser()

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
        <Link to="/app" className="font-bold max-[1023px]:hidden">
          Opa Finance
        </Link>
        <Button
          type="button"
          variant="ghost"
          className="p-0 font-bold text-foreground hover:bg-transparent min-[1024px]:hidden"
          onClick={onMenuClick}
        >
          Opa Finance
        </Button>
      </div>

      <span className="text-sm font-medium text-muted-foreground">
        {user?.name ?? 'Conta'}
      </span>
    </header>
  )
}
