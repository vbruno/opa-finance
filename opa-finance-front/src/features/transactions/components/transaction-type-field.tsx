import type { FieldErrors, UseFormRegister } from 'react-hook-form'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type TransactionTypeFieldProps = {
  id: string
  register: UseFormRegister<any>
  errors: FieldErrors<any>
  type: 'income' | 'expense' | ''
}

export function TransactionTypeField({ id, register, errors, type }: TransactionTypeFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Tipo</Label>
      <input type="hidden" {...register('type')} />
      <Input
        id={id}
        className="h-10 cursor-not-allowed bg-muted/30"
        readOnly
        tabIndex={-1}
        placeholder="Receita/Despesa"
        aria-invalid={!!errors.type}
        value={type === 'income' ? 'Receita' : type === 'expense' ? 'Despesa' : ''}
      />
      {errors.type && (
        <p className="text-sm text-destructive">{String(errors.type.message)}</p>
      )}
    </div>
  )
}
