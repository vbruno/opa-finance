import { Button } from '@/components/ui/button'

type AccountsPaginationProps = {
  sortedAccountsCount: number
  pageSize: number
  safePage: number
  totalPages: number
  onChangePageSize: (size: number) => void
  onFirstPage: () => void
  onPreviousPage: () => void
  onNextPage: () => void
  onLastPage: () => void
}

export function AccountsPagination({
  sortedAccountsCount,
  pageSize,
  safePage,
  totalPages,
  onChangePageSize,
  onFirstPage,
  onPreviousPage,
  onNextPage,
  onLastPage,
}: AccountsPaginationProps) {
  if (sortedAccountsCount <= pageSize) {
    return null
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        Pagina {safePage} de {totalPages}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full sm:w-[110px]">
          <select
            className="h-11 w-full appearance-none rounded-md border bg-background px-3 pr-10 text-sm sm:h-9"
            value={String(pageSize)}
            onChange={(event) => onChangePageSize(Number(event.target.value))}
            aria-label="Quantidade de linhas"
          >
            {[5, 10, 20, 30, 50].map((size) => (
              <option key={size} value={String(size)}>
                {size}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground">
            <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
              <path
                d="M4 6l4 4 4-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>
        <Button
          variant="outline"
          className="h-11 w-full sm:h-9 sm:w-auto"
          disabled={safePage === 1}
          onClick={onFirstPage}
        >
          Primeira
        </Button>
        <Button
          variant="outline"
          className="h-11 w-full sm:h-9 sm:w-auto"
          disabled={safePage === 1}
          onClick={onPreviousPage}
        >
          Anterior
        </Button>
        <Button
          variant="outline"
          className="h-11 w-full sm:h-9 sm:w-auto"
          disabled={safePage === totalPages}
          onClick={onNextPage}
        >
          Proxima
        </Button>
        <Button
          variant="outline"
          className="h-11 w-full sm:h-9 sm:w-auto"
          disabled={safePage === totalPages}
          onClick={onLastPage}
        >
          Ultima
        </Button>
      </div>
    </div>
  )
}
