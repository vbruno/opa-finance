import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

function buildPaginationItems(
  current: number,
  total: number | null,
  hasMore = false,
): Array<number | '...'> {
  if (total === null) {
    const items: Array<number | '...'> = []
    if (current > 2) items.push('...')
    if (current > 1) items.push(current - 1)
    items.push(current)
    if (hasMore) items.push(current + 1)
    if (hasMore) items.push('...')
    return items
  }

  if (total <= 1) return [1]

  const items: Array<number | '...'> = []
  const siblings = 1
  const showLeftEllipsis = current > 2 + siblings
  const showRightEllipsis = current < total - (1 + siblings)

  items.push(1)
  if (showLeftEllipsis) items.push('...')

  const start = Math.max(2, current - siblings)
  const end = Math.min(total - 1, current + siblings)
  for (let p = start; p <= end; p++) items.push(p)

  if (showRightEllipsis) items.push('...')
  if (total > 1) items.push(total)

  return items
}

type TablePaginationProps = {
  page: number
  totalPages: number | null
  hasMore: boolean
  onPageChange: (page: number) => void
  pageSize?: number
  onPageSizeChange?: (size: number) => void
  pageSizeOptions?: number[]
  totalRecords?: number
  isLoading?: boolean
}

export function TablePagination({
  page,
  totalPages,
  hasMore,
  onPageChange,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 30, 50],
  totalRecords,
  isLoading = false,
}: TablePaginationProps) {
  const paginationItems = buildPaginationItems(page, totalPages, hasMore)

  return (
    <div className="flex items-center justify-between border-t bg-card px-4 py-2 text-xs">
      <span className="text-muted-foreground">
        {isLoading
          ? `Carregando página ${page}...`
          : totalPages
            ? `Página ${page} de ${totalPages}${totalRecords != null ? ` • ${totalRecords} registros` : ''}`
            : `Página ${page}`}
      </span>
      <div className="flex items-center gap-3">
        {pageSize != null && onPageSizeChange != null ? (
          <Select
            value={String(pageSize)}
            disabled={isLoading}
            onValueChange={(v) => onPageSizeChange(Number(v))}
          >
            <SelectTrigger
              className="h-8 w-[72px] bg-background px-2 text-xs dark:border-muted/80"
              aria-label="Quantidade de linhas"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page === 1 || isLoading}
            onClick={() => onPageChange(page - 1)}
            aria-label="Página anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {paginationItems
            ? paginationItems.map((item, i) =>
                item === '...' ? (
                  <span key={`ellipsis-${i}`} className="px-1 text-muted-foreground">
                    ...
                  </span>
                ) : (
                  <Button
                    key={`page-${item}`}
                    type="button"
                    variant={item === page ? 'default' : 'outline'}
                    size="sm"
                    disabled={isLoading}
                    onClick={() => onPageChange(item)}
                  >
                    {item}
                  </Button>
                ),
              )
            : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={(totalPages ? page >= totalPages : !hasMore) || isLoading}
            onClick={() => onPageChange(page + 1)}
            aria-label="Próxima página"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
