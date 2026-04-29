import type { Control, FieldErrors } from 'react-hook-form'
import { Controller } from 'react-hook-form'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Account } from '@/features/accounts'

type TransactionAccountFieldProps = {
  id: string
  label: string
  fieldName?: string
  control: Control<any>
  errors: FieldErrors<any>
  accounts: Account[]
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  tabIndex?: number
}

export function TransactionAccountField({
  id,
  label,
  fieldName = 'accountId',
  control,
  errors,
  accounts,
  isOpen,
  onOpenChange,
  tabIndex,
}: TransactionAccountFieldProps) {
  const error = errors[fieldName]

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Controller
        control={control}
        name={fieldName}
        render={({ field }) => (
          <Select
            open={isOpen}
            value={field.value ? field.value : '__none__'}
            onValueChange={(value) =>
              field.onChange(value === '__none__' ? '' : value)
            }
            onOpenChange={onOpenChange}
          >
            <SelectTrigger
              id={id}
              className="h-10"
              aria-invalid={!!error}
              tabIndex={tabIndex}
            >
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent
              onEscapeKeyDown={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onOpenChange(false)
              }}
            >
              <SelectItem value="__none__" className="hidden">
                Selecione
              </SelectItem>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      {error && (
        <p className="text-sm text-destructive">{String(error.message)}</p>
      )}
    </div>
  )
}
