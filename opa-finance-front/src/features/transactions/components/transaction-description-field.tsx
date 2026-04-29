import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { FieldErrors, UseFormRegister, UseFormSetValue } from 'react-hook-form'

import { Label } from '@/components/ui/label'
import type { TransactionCreateFormData } from '@/schemas/transaction.schema'

import { TransactionsDescriptionAutocomplete } from './transactions-description-autocomplete'

type TransactionDescriptionFieldProps = {
  id: string
  register: UseFormRegister<any>
  errors: FieldErrors<any>
  descriptionInputRef: RefObject<HTMLInputElement | null>
  setValue: UseFormSetValue<TransactionCreateFormData>
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
}

export function TransactionDescriptionField({
  id,
  register,
  errors,
  descriptionInputRef,
  setValue,
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
}: TransactionDescriptionFieldProps) {
  const descriptionRegister = register('description')
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Descrição</Label>
      <TransactionsDescriptionAutocomplete
        id={id}
        descriptionRegister={descriptionRegister}
        descriptionInputRef={descriptionInputRef}
        isInvalid={!!errors.description}
        descriptionSuggestions={descriptionSuggestions}
        areDescriptionSuggestionsLoading={areDescriptionSuggestionsLoading}
        hasDescriptionSuggestionsError={hasDescriptionSuggestionsError}
        shouldFilterSuggestions={shouldFilterSuggestions}
        isDescriptionSuggestionsOpen={isDescriptionSuggestionsOpen}
        setIsDescriptionSuggestionsOpen={setIsDescriptionSuggestionsOpen}
        isDescriptionFocused={isDescriptionFocused}
        setIsDescriptionFocused={setIsDescriptionFocused}
        activeSuggestionIndex={activeSuggestionIndex}
        setActiveSuggestionIndex={setActiveSuggestionIndex}
        setValue={setValue}
      />
      {errors.description && (
        <p className="text-sm text-destructive">{String(errors.description.message)}</p>
      )}
    </div>
  )
}
