import type { RefObject } from 'react'
import type { Control, FieldErrors } from 'react-hook-form'
import { Controller } from 'react-hook-form'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type TransactionAmountFieldProps = {
  id: string
  control: Control<any>
  errors: FieldErrors<any>
  amountRef?: RefObject<HTMLInputElement | null>
  onAmountChange: (rawValue: string, onChange: (value: string) => void) => void
  clearAmountError: () => void
  onAmountBlur?: (value: string, onChange: (value: string) => void) => void
  tabIndex?: number
  inputMode?: 'decimal' | 'numeric'
}

export function TransactionAmountField({
  id,
  control,
  errors,
  amountRef,
  onAmountChange,
  clearAmountError,
  onAmountBlur,
  tabIndex,
  inputMode = 'decimal',
}: TransactionAmountFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Valor</Label>
      <Controller
        control={control}
        name="amount"
        render={({ field }) => (
          <Input
            id={id}
            type="text"
            inputMode={inputMode}
            placeholder="$ 0,00"
            className="h-10"
            ref={amountRef}
            value={field.value}
            onChange={(event) => {
              onAmountChange(event.target.value, field.onChange)
            }}
            onKeyDown={(event) => {
              if (event.key === '=') {
                event.preventDefault()
                field.onChange('=')
                clearAmountError()
              }
            }}
            onBlur={
              onAmountBlur
                ? () => {
                    onAmountBlur(field.value, field.onChange)
                    field.onBlur()
                  }
                : undefined
            }
            aria-invalid={!!errors.amount}
            tabIndex={tabIndex}
          />
        )}
      />
      {errors.amount && (
        <p className="text-sm text-destructive">{String(errors.amount.message)}</p>
      )}
    </div>
  )
}
