import type { RefObject } from 'react'
import type { Control, FieldErrors } from 'react-hook-form'
import { Controller } from 'react-hook-form'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { sanitizeExpressionInput } from '@/lib/expression'
import {
  formatCurrencyInput,
  formatCurrencyValue,
  parseCurrencyInput,
} from '@/lib/utils'

type TransactionAmountFieldProps = {
  id: string
  control: Control<any>
  errors: FieldErrors<any>
  amountRef?: RefObject<HTMLInputElement | null>
  clearAmountError: () => void
  setAmountError?: (message: string) => void
  tabIndex?: number
  inputMode?: 'decimal' | 'numeric'
  disabled?: boolean
}

export function TransactionAmountField({
  id,
  control,
  errors,
  amountRef,
  clearAmountError,
  setAmountError,
  tabIndex,
  inputMode = 'decimal',
  disabled,
}: TransactionAmountFieldProps) {
  function handleAmountChange(
    rawValue: string,
    onChange: (value: string) => void,
  ) {
    if (rawValue.trimStart().startsWith('=')) {
      onChange(sanitizeExpressionInput(rawValue))
      clearAmountError()
      return
    }
    onChange(formatCurrencyInput(rawValue))
    clearAmountError()
  }

  function handleAmountBlur(
    value: string,
    onChange: (value: string) => void,
  ) {
    const trimmed = value.trim()
    if (!trimmed.startsWith('=')) {
      return
    }

    const parsed = parseCurrencyInput(trimmed)
    if (parsed === null || Number.isNaN(parsed) || parsed <= 0) {
      setAmountError?.('Informe uma expressão válida.')
      return
    }

    onChange(`$ ${formatCurrencyValue(parsed)}`)
    clearAmountError()
  }

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
              handleAmountChange(event.target.value, field.onChange)
            }}
            onKeyDown={(event) => {
              if (event.key === '=') {
                event.preventDefault()
                field.onChange('=')
                clearAmountError()
              }
            }}
            onBlur={() => {
              handleAmountBlur(field.value, field.onChange)
              field.onBlur()
            }}
            aria-invalid={!!errors.amount}
            tabIndex={tabIndex}
            disabled={disabled}
          />
        )}
      />
      {errors.amount && (
        <p className="text-sm text-destructive">{String(errors.amount.message)}</p>
      )}
    </div>
  )
}
