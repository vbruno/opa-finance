import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export function ShortcutLabel({
  label,
  shortcutIndex,
}: {
  label: string
  shortcutIndex: number
}) {
  const safeIndex =
    shortcutIndex >= 0 && shortcutIndex < label.length ? shortcutIndex : 0

  return (
    <span className="inline">
      {label.slice(0, safeIndex)}
      <span className="underline decoration-[1.5px] underline-offset-2 text-current/90">
        {label[safeIndex]}
      </span>
      {label.slice(safeIndex + 1)}
    </span>
  )
}

export function ShortcutTooltip({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('group/shortcut relative w-full sm:w-auto', className)}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 invisible -translate-x-1/2 whitespace-nowrap rounded-md border bg-background/95 px-2 py-1 text-[11px] text-muted-foreground opacity-0 shadow-sm transition-[opacity,visibility] duration-150 delay-0 group-hover/shortcut:visible group-hover/shortcut:opacity-100 group-hover/shortcut:delay-[1200ms] group-focus-within/shortcut:visible group-focus-within/shortcut:opacity-100 group-focus-within/shortcut:delay-[1200ms] sm:block"
      >
        {label}
      </span>
    </div>
  )
}
