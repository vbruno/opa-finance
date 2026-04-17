import type { FormEventHandler } from 'react'
import type { UseFormReturn } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ChangePasswordFormData } from '@/schemas/user.schema'

type ProfilePasswordSectionProps = {
  showPasswords: boolean
  passwordMessage: string | null
  isUpdatingPassword: boolean
  passwordForm: UseFormReturn<ChangePasswordFormData>
  onToggleShowPasswords: (value: boolean) => void
  onSubmit: FormEventHandler<HTMLFormElement>
}

export function ProfilePasswordSection({
  showPasswords,
  passwordMessage,
  isUpdatingPassword,
  passwordForm,
  onToggleShowPasswords,
  onSubmit,
}: ProfilePasswordSectionProps) {
  return (
    <section className="rounded-lg border bg-background p-4 shadow-sm sm:p-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Alterar senha</h2>
        <p className="text-sm text-muted-foreground">Use uma senha forte e única.</p>
      </div>

      <form onSubmit={onSubmit} className="mt-4 grid gap-4 sm:grid-cols-2">
        <label
          htmlFor="toggle-password-visibility"
          className="flex items-center gap-2 text-sm sm:col-span-2"
        >
          <input
            id="toggle-password-visibility"
            type="checkbox"
            className="h-5 w-5 accent-primary"
            checked={showPasswords}
            onChange={(event) => onToggleShowPasswords(event.target.checked)}
          />
          <span>Mostrar senhas</span>
        </label>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="current-password">Senha atual</Label>
          <Input
            id="current-password"
            type={showPasswords ? 'text' : 'password'}
            placeholder="••••••••"
            disabled={isUpdatingPassword}
            aria-invalid={!!passwordForm.formState.errors.currentPassword}
            {...passwordForm.register('currentPassword')}
          />
          {passwordForm.formState.errors.currentPassword && (
            <p className="text-sm text-destructive">
              {passwordForm.formState.errors.currentPassword.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="new-password">Nova senha</Label>
          <Input
            id="new-password"
            type={showPasswords ? 'text' : 'password'}
            placeholder="••••••••"
            disabled={isUpdatingPassword}
            aria-invalid={!!passwordForm.formState.errors.newPassword}
            {...passwordForm.register('newPassword')}
          />
          {passwordForm.formState.errors.newPassword && (
            <p className="text-sm text-destructive">
              {passwordForm.formState.errors.newPassword.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirmar nova senha</Label>
          <Input
            id="confirm-password"
            type={showPasswords ? 'text' : 'password'}
            placeholder="••••••••"
            disabled={isUpdatingPassword}
            aria-invalid={!!passwordForm.formState.errors.confirmNewPassword}
            {...passwordForm.register('confirmNewPassword')}
          />
          {passwordForm.formState.errors.confirmNewPassword && (
            <p className="text-sm text-destructive">
              {passwordForm.formState.errors.confirmNewPassword.message}
            </p>
          )}
        </div>

        {passwordForm.formState.errors.root?.message && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive sm:col-span-2">
            {passwordForm.formState.errors.root.message}
          </div>
        )}
        {passwordMessage && (
          <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700 sm:col-span-2">
            {passwordMessage}
          </div>
        )}

        <div className="sm:col-span-2">
          <Button
            type="submit"
            className="h-11 w-full sm:h-10 sm:w-auto"
            disabled={isUpdatingPassword || passwordForm.formState.isSubmitting}
          >
            {isUpdatingPassword ? 'Atualizando...' : 'Atualizar senha'}
          </Button>
        </div>
      </form>
    </section>
  )
}
