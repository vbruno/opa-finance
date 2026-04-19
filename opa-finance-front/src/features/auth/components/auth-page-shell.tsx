import type { ReactNode } from 'react'

import { ThemeToggle } from '@/components/theme/ThemeToggle'

type AuthPageShellProps = {
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
}

export function AuthPageShell({
  title,
  subtitle,
  children,
  footer,
}: AuthPageShellProps) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/30 p-4">
      <div className="relative w-full max-w-sm space-y-5 rounded-lg border bg-background p-4 shadow-sm sm:p-6">
        <div className="absolute right-3 top-3 sm:right-4 sm:top-4">
          <ThemeToggle />
        </div>

        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>

        {children}

        {footer ? <div className="text-center text-sm">{footer}</div> : null}
      </div>
    </div>
  )
}
