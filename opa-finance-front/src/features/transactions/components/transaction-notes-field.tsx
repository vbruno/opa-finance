import type { FieldErrors, UseFormRegister } from 'react-hook-form'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type TransactionNotesFieldProps = {
  id: string
  label?: string
  fieldName?: string
  register: UseFormRegister<any>
  errors: FieldErrors<any>
  tabIndex?: number
}

export function TransactionNotesField({
  id,
  label = 'Notas',
  fieldName = 'notes',
  register,
  errors,
  tabIndex,
}: TransactionNotesFieldProps) {
  const error = errors[fieldName]

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        placeholder="Opcional"
        className="h-10"
        aria-invalid={!!error}
        tabIndex={tabIndex}
        {...register(fieldName)}
      />
      {error && (
        <p className="text-sm text-destructive">{String(error.message)}</p>
      )}
    </div>
  )
}
