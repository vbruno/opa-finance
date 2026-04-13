import { SlidersHorizontal } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'

import { Button } from '@/components/ui/button'

type TransactionsToolbarProps = {
  isFiltersOpen: boolean
  hasActiveFilters: boolean
  isCreateMenuOpen: boolean
  setIsFiltersOpen: Dispatch<SetStateAction<boolean>>
  setIsCreateMenuOpen: Dispatch<SetStateAction<boolean>>
  onOpenTransactionCreate: () => void
  onOpenTransferCreate: () => void
}

export function TransactionsToolbar({
  isFiltersOpen,
  hasActiveFilters,
  isCreateMenuOpen,
  setIsFiltersOpen,
  setIsCreateMenuOpen,
  onOpenTransactionCreate,
  onOpenTransferCreate,
}: TransactionsToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-2xl font-bold">Transações</h2>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:w-auto">
        <Button
          variant={hasActiveFilters || isFiltersOpen ? 'secondary' : 'outline'}
          size="icon"
          className="h-10 w-10 sm:hidden"
          aria-label={isFiltersOpen ? 'Ocultar filtros' : 'Mostrar filtros'}
          onClick={() => setIsFiltersOpen((prev) => !prev)}
        >
          <SlidersHorizontal className="size-4" />
        </Button>
        <div className="relative">
          <Button
            variant="default"
            className="h-10"
            aria-haspopup="menu"
            aria-expanded={isCreateMenuOpen}
            onClick={() => setIsCreateMenuOpen((prev) => !prev)}
          >
            Adicionar
          </Button>
          {isCreateMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setIsCreateMenuOpen(false)}
              />
              <div className="absolute right-0 top-full z-20 mt-2 w-48 rounded-md border bg-background p-2 shadow-lg">
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  title="Atalho: N"
                  onClick={() => {
                    setIsCreateMenuOpen(false)
                    onOpenTransactionCreate()
                  }}
                >
                  <span className="flex flex-1 items-center justify-between">
                    Transação
                    <span className="text-xs text-muted-foreground">N</span>
                  </span>
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  title="Atalho: T"
                  onClick={() => {
                    setIsCreateMenuOpen(false)
                    onOpenTransferCreate()
                  }}
                >
                  <span className="flex flex-1 items-center justify-between">
                    Transferência
                    <span className="text-xs text-muted-foreground">T</span>
                  </span>
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
