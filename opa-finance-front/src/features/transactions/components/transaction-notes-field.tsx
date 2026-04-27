import type { FieldErrors, UseFormRegister } from 'react-hook-form'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type TransactionNotesFieldProps = {
  id: string
  register: UseFormRegister<any>
  errors: FieldErrors<any>
  tabIndex?: number
}

export function TransactionNotesField({ id, register, errors, tabIndex }: TransactionNotesFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Notas</Label>
      <Input
        id={id}
        placeholder="Opcional"
        className="h-10"
        aria-invalid={!!errors.notes}
        tabIndex={tabIndex}
        {...register('notes')}
      />
      {errors.notes && (
        <p className="text-sm text-destructive">{String(errors.notes.message)}</p>
      )}
    </div>
  )
}
