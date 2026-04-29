import type { RefObject } from 'react'
import type { FieldErrors, UseFormRegister } from 'react-hook-form'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type TransactionDateFieldProps = {
  id: string
  label?: string
  fieldName?: string
  register: UseFormRegister<any>
  errors: FieldErrors<any>
  isMobile: boolean
  tabIndex?: number
  dateRef?: RefObject<HTMLInputElement | null>
  disabled?: boolean
}

export function TransactionDateField({
  id,
  label = 'Data',
  fieldName = 'date',
  register,
  errors,
  isMobile,
  tabIndex,
  dateRef,
  disabled,
}: TransactionDateFieldProps) {
  const dateRegister = register(fieldName)
  const error = errors[fieldName]

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="date"
        className="h-10"
        aria-invalid={!!error}
        disabled={disabled}
        onFocus={(event) => {
          if (!isMobile) return
          const input = event.currentTarget
          if (typeof input.showPicker === 'function') input.showPicker()
        }}
        inputMode={isMobile ? 'none' : undefined}
        tabIndex={tabIndex}
        {...dateRegister}
        ref={(element) => {
          dateRegister.ref(element)
          if (dateRef) dateRef.current = element
        }}
        onClick={(event) => {
          const target = event.currentTarget
          if (typeof target.showPicker !== 'function') return
          if (isMobile || event.detail > 0) target.showPicker()
        }}
        onKeyDown={(event) => {
          if (isMobile) event.preventDefault()
        }}
        onPaste={(event) => {
          if (isMobile) event.preventDefault()
        }}
      />
      {error && (
        <p className="text-sm text-destructive">{String(error.message)}</p>
      )}
    </div>
  )
}
