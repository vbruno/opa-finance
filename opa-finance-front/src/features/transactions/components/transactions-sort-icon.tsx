type TransactionsSortIconProps = {
  isActive: boolean
  direction: 'asc' | 'desc'
}

export function TransactionsSortIcon({
  isActive,
  direction,
}: TransactionsSortIconProps) {
  if (!isActive) {
    return (
      <span className="text-muted-foreground">
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
          <path
            d="M5 3l3-3 3 3M11 13l-3 3-3-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    )
  }

  return (
    <span className="text-foreground">
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
        <path
          d={direction === 'asc' ? 'M4 10l4-4 4 4' : 'M4 6l4 4 4-4'}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}
