import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { UseFormRegisterReturn } from 'react-hook-form'

import { Input } from '@/components/ui/input'
import type { TransactionCreateFormData } from '@/schemas/transaction.schema'

type TransactionsDescriptionAutocompleteProps = {
  descriptionRegister: UseFormRegisterReturn<'description'>
  descriptionInputRef: RefObject<HTMLInputElement | null>
  isInvalid: boolean
  descriptionSuggestions: string[]
  areDescriptionSuggestionsLoading: boolean
  hasDescriptionSuggestionsError: boolean
  shouldFilterSuggestions: boolean
  isDescriptionSuggestionsOpen: boolean
  setIsDescriptionSuggestionsOpen: Dispatch<SetStateAction<boolean>>
  isDescriptionFocused: boolean
  setIsDescriptionFocused: Dispatch<SetStateAction<boolean>>
  activeSuggestionIndex: number
  setActiveSuggestionIndex: Dispatch<SetStateAction<number>>
  setValue: (
    name: keyof TransactionCreateFormData,
    value: string,
    options?: { shouldDirty?: boolean; shouldTouch?: boolean },
  ) => void
}

export function TransactionsDescriptionAutocomplete({
  descriptionRegister,
  descriptionInputRef,
  isInvalid,
  descriptionSuggestions,
  areDescriptionSuggestionsLoading,
  hasDescriptionSuggestionsError,
  shouldFilterSuggestions,
  isDescriptionSuggestionsOpen,
  setIsDescriptionSuggestionsOpen,
  isDescriptionFocused,
  setIsDescriptionFocused,
  activeSuggestionIndex,
  setActiveSuggestionIndex,
  setValue,
}: TransactionsDescriptionAutocompleteProps) {
  return (
    <div className="relative">
      <Input
        id="transaction-description"
        placeholder="Ex: Supermercado"
        className="h-10"
        autoComplete="off"
        tabIndex={1}
        aria-invalid={isInvalid}
        {...descriptionRegister}
        ref={(element) => {
          descriptionRegister.ref(element)
          descriptionInputRef.current = element
        }}
        onFocus={() => {
          setIsDescriptionFocused(true)
          setIsDescriptionSuggestionsOpen(true)
        }}
        onBlur={(event) => {
          descriptionRegister.onBlur(event)
          setIsDescriptionFocused(false)
          setIsDescriptionSuggestionsOpen(false)
        }}
        onChange={(event) => {
          descriptionRegister.onChange(event)
          if (isDescriptionFocused && event.target.value.includes(' ')) {
            setIsDescriptionSuggestionsOpen(true)
          }
        }}
        onKeyDown={(event) => {
          if (!isDescriptionSuggestionsOpen) {
            return
          }
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setActiveSuggestionIndex((prev) =>
              Math.min(prev + 1, Math.max(0, descriptionSuggestions.length - 1)),
            )
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault()
            setActiveSuggestionIndex((prev) => Math.max(prev - 1, 0))
          }
          if (event.key === 'Enter') {
            if (descriptionSuggestions.length === 0) {
              return
            }
            event.preventDefault()
            const selected = descriptionSuggestions[activeSuggestionIndex]
            if (!selected) {
              return
            }
            setValue('description', selected, {
              shouldDirty: true,
              shouldTouch: true,
            })
            setIsDescriptionSuggestionsOpen(false)
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            setIsDescriptionSuggestionsOpen(false)
          }
        }}
      />
      {isDescriptionSuggestionsOpen && (
        <div className="absolute z-10 mt-1 w-full rounded-md border bg-background shadow-lg">
          {areDescriptionSuggestionsLoading ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              {shouldFilterSuggestions
                ? 'Buscando sugestões...'
                : 'Carregando sugestões...'}
            </div>
          ) : hasDescriptionSuggestionsError ? (
            <div className="px-3 py-2 text-sm text-destructive">
              Erro ao carregar sugestões.
            </div>
          ) : descriptionSuggestions.length > 0 ? (
            descriptionSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className={`flex w-full items-center px-3 py-2 text-left text-sm ${
                  suggestion === descriptionSuggestions[activeSuggestionIndex]
                    ? 'bg-muted/60'
                    : 'hover:bg-muted/40'
                }`}
                onMouseDown={(event) => {
                  event.preventDefault()
                  setValue('description', suggestion, {
                    shouldDirty: true,
                    shouldTouch: true,
                  })
                  setIsDescriptionSuggestionsOpen(false)
                  window.requestAnimationFrame(() => {
                    descriptionInputRef.current?.focus()
                  })
                }}
              >
                {suggestion}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              Nenhuma sugestão encontrada.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
