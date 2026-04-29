import type { FieldErrors, UseFormRegister } from 'react-hook-form'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type TransactionTypeFieldProps = {
  id: string
  label?: string
  fieldName?: string
  register?: UseFormRegister<any>
  errors: FieldErrors<any>
  type: 'income' | 'expense' | ''
}

export function TransactionTypeField({
  id,
  label = 'Tipo',
  fieldName = 'type',
  register,
  errors,
  type,
}: TransactionTypeFieldProps) {
  const error = errors[fieldName]

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {register ? <input type="hidden" {...register(fieldName)} /> : null}
      <Input
        id={id}
        className="h-10 cursor-not-allowed bg-muted/30"
        readOnly
        tabIndex={-1}
        placeholder="Receita/Despesa"
        aria-invalid={!!error}
        value={type === 'income' ? 'Receita' : type === 'expense' ? 'Despesa' : ''}
      />
      {error && (
        <p className="text-sm text-destructive">{String(error.message)}</p>
      )}
    </div>
  )
}
