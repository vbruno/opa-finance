import type { KeyboardEventHandler, RefObject } from 'react'
import type { Control, FieldErrors } from 'react-hook-form'
import { Controller } from 'react-hook-form'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import {
  CATEGORY_TREE_CREATE,
  CATEGORY_TREE_CREATE_SUB,
  CATEGORY_TREE_NONE,
} from '../hooks/use-category-tree-interaction'

export type CategoryTreeOption = {
  value: string
  label: string
  level: 'category' | 'subcategory'
}

type TransactionCategoryFieldProps = {
  id: string
  control: Control<any>
  errors: FieldErrors<any>
  isOpen: boolean
  options: CategoryTreeOption[]
  search: string
  onSearchChange: (value: string) => void
  contentRef: RefObject<HTMLDivElement | null>
  searchInputRef: RefObject<HTMLInputElement | null>
  triggerRef?: RefObject<HTMLButtonElement | null>
  tabIndex?: number
  disabled?: boolean
  disabledMessage?: string
  getCategoryTreeValue: () => string
  onValueChange: (value: string, onChange: (value: string) => void) => void
  onOpenChange: (open: boolean) => void
  onSearchKeyDown: KeyboardEventHandler<HTMLInputElement>
  onItemKeyDown: KeyboardEventHandler<HTMLDivElement>
}

export function TransactionCategoryField({
  id,
  control,
  errors,
  isOpen,
  options,
  search,
  onSearchChange,
  contentRef,
  searchInputRef,
  triggerRef,
  tabIndex,
  disabled,
  disabledMessage,
  getCategoryTreeValue,
  onValueChange,
  onOpenChange,
  onSearchKeyDown,
  onItemKeyDown,
}: TransactionCategoryFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Categoria/Subcategoria</Label>
      <Controller
        control={control}
        name="categoryId"
        render={({ field }) => (
          <Select
            open={isOpen}
            disabled={disabled}
            value={getCategoryTreeValue()}
            onValueChange={(value) => onValueChange(value, field.onChange)}
            onOpenChange={onOpenChange}
          >
            <SelectTrigger
              id={id}
              className="h-10 [&>span]:truncate"
              aria-invalid={!!errors.categoryId}
              tabIndex={tabIndex}
              ref={triggerRef}
            >
              <SelectValue placeholder="Selecione categoria/subcategoria" />
            </SelectTrigger>
            <SelectContent
              ref={contentRef}
              onEscapeKeyDown={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onOpenChange(false)
              }}
            >
              <div className="px-2 pb-2">
                <Input
                  placeholder="Buscar categoria ou subcategoria..."
                  className="h-9"
                  value={search}
                  onChange={(event) => onSearchChange(event.target.value)}
                  onKeyDown={onSearchKeyDown}
                  onKeyUp={(event) => {
                    const isTypingKey =
                      (event.key.length === 1 ||
                        event.key === 'Dead' ||
                        event.key === 'Backspace' ||
                        event.key === 'Delete') &&
                      !event.ctrlKey &&
                      !event.metaKey &&
                      !event.altKey
                    if (isTypingKey) {
                      event.stopPropagation()
                      event.nativeEvent.stopImmediatePropagation?.()
                    }
                  }}
                  ref={searchInputRef}
                />
              </div>
              <SelectItem value={CATEGORY_TREE_NONE} className="hidden" textValue="none">
                Selecione
              </SelectItem>
              <SelectItem
                value={CATEGORY_TREE_CREATE}
                onKeyDown={onItemKeyDown}
                textValue="create-category"
              >
                + Nova categoria
              </SelectItem>
              <SelectItem
                value={CATEGORY_TREE_CREATE_SUB}
                onKeyDown={onItemKeyDown}
                textValue="create-subcategory"
              >
                + Nova subcategoria
              </SelectItem>
              {options.map((option, optionIndex) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  onKeyDown={onItemKeyDown}
                  textValue={`option-${optionIndex}`}
                  className={
                    option.level === 'subcategory'
                      ? 'pl-10 text-muted-foreground'
                      : 'font-medium'
                  }
                >
                  {option.label}
                </SelectItem>
              ))}
              {options.length === 0 && (
                <div className="px-2 py-2 text-sm text-muted-foreground">
                  Nenhuma categoria/subcategoria encontrada.
                </div>
              )}
            </SelectContent>
          </Select>
        )}
      />
      {errors.categoryId && (
        <p className="text-sm text-destructive">{String(errors.categoryId.message)}</p>
      )}
      {errors.subcategoryId && (
        <p className="text-sm text-destructive">{String(errors.subcategoryId.message)}</p>
      )}
      {disabledMessage && (
        <p className="text-xs text-muted-foreground">{disabledMessage}</p>
      )}
    </div>
  )
}
