import type { FormEventHandler, MutableRefObject } from 'react'
import type { UseFormRegisterReturn } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ShortcutTooltip } from '@/components/ui/shortcut-hint'
import { ACCOUNT_TYPE_OPTIONS } from '@/features/accounts/model/accounts.constants'
type AccountCreateModalProps = {
  isOpen: boolean
  nameField: UseFormRegisterReturn<'name'>
  registerTypeField: UseFormRegisterReturn<'type'>
  registerConfirmField: UseFormRegisterReturn<'confirm'>
  errors: {
    name?: { message?: string }
    type?: { message?: string }
    confirm?: { message?: string }
    root?: { message?: string }
  }
  confirmValue: boolean
  isSubmitting: boolean
  isMutationPending: boolean
  createNameRef: MutableRefObject<HTMLInputElement | null>
  onClose: () => void
  onSubmit: FormEventHandler<HTMLFormElement>
}

export function AccountCreateModal({
  isOpen,
  nameField,
  registerTypeField,
  registerConfirmField,
  errors,
  confirmValue,
  isSubmitting,
  isMutationPending,
  createNameRef,
  onClose,
  onSubmit,
}: AccountCreateModalProps) {
  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div
        className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-lg border bg-background p-4 shadow-lg sm:max-h-none sm:overflow-visible sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-create-modal-title"
        aria-describedby="account-create-modal-description"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 id="account-create-modal-title" className="text-lg font-semibold">
              Criar nova conta
            </h3>
            <p
              id="account-create-modal-description"
              className="text-sm text-muted-foreground"
            >
              Preencha os dados básicos para adicionar uma conta.
            </p>
          </div>
        </div>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="account-name">Nome</Label>
            <Input
              id="account-name"
              placeholder="Ex: Conta Corrente"
              className="h-10"
              aria-invalid={!!errors.name}
              {...nameField}
              ref={(node) => {
                nameField.ref(node)
                createNameRef.current = node
              }}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="account-type">Tipo</Label>
            <select
              id="account-type"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              aria-invalid={!!errors.type}
              {...registerTypeField}
            >
              <option value="">Selecione</option>
              {ACCOUNT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.type && (
              <p className="text-sm text-destructive">{errors.type.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="h-5 w-5 accent-primary sm:h-4 sm:w-4"
                {...registerConfirmField}
              />
              Confirmo que os dados estão corretos
            </label>
            <ShortcutTooltip label="Atalho: Ctrl/Cmd+Enter">
              <Button
                type="submit"
                className="w-full sm:w-auto"
                disabled={!confirmValue || isSubmitting}
              >
                {isSubmitting || isMutationPending ? 'Criando...' : 'Criar conta'}
              </Button>
            </ShortcutTooltip>
          </div>
          {errors.confirm && (
            <p className="text-sm text-destructive">{errors.confirm.message}</p>
          )}
          {errors.root?.message && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {errors.root.message}
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
