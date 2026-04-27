import type { RefObject } from 'react'
import type { FieldErrors, UseFormRegister } from 'react-hook-form'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type TransactionDateFieldProps = {
  id: string
  register: UseFormRegister<any>
  errors: FieldErrors<any>
  isMobile: boolean
  tabIndex?: number
  dateRef?: RefObject<HTMLInputElement | null>
}

export function TransactionDateField({
  id,
  register,
  errors,
  isMobile,
  tabIndex,
  dateRef,
}: TransactionDateFieldProps) {
  const dateRegister = register('date')
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Data</Label>
      <Input
        id={id}
        type="date"
        className="h-10"
        aria-invalid={!!errors.date}
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
      {errors.date && (
        <p className="text-sm text-destructive">{String(errors.date.message)}</p>
      )}
    </div>
  )
}
