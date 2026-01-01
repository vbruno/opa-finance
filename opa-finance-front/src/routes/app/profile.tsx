import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { getUser, updateUser, type User } from '@/features/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useChangePassword } from '@/features/auth'
import { useUpdateProfile } from '@/features/profile'
import { getApiErrorMessage } from '@/lib/apiError'
import {
  changePasswordSchema,
  updateProfileSchema,
  type ChangePasswordFormData,
  type UpdateProfileFormData,
} from '@/schemas/user.schema'

export const Route = createFileRoute('/app/profile')({
  component: Profile,
})

function Profile() {
  const [user, setUser] = useState<User | null>(() => getUser())
  const [profileMessage, setProfileMessage] = useState<string | null>(null)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)
  const [showPasswords, setShowPasswords] = useState(false)
  const isUserReady = !!user
  const createdAtLabel = formatCreatedAt(user?.createdAt)

  const profileForm = useForm<UpdateProfileFormData>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      name: user?.name ?? '',
    },
  })

  const passwordForm = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmNewPassword: '',
    },
  })

  const updateProfileMutation = useUpdateProfile()
  const changePasswordMutation = useChangePassword()

  async function onUpdateProfile(formData: UpdateProfileFormData) {
    setProfileMessage(null)
    try {
      if (!user) {
        throw new Error('Usuário não encontrado')
      }
      const updatedUser = await updateProfileMutation.mutateAsync({
        id: user.id,
        name: formData.name,
      })
      updateUser(updatedUser)
      setUser(updatedUser)
      profileForm.reset({ name: updatedUser.name })
      setProfileMessage('Perfil atualizado com sucesso.')
    } catch (error: unknown) {
      profileForm.setError('root', {
        message: getApiErrorMessage(error, {
          defaultMessage: 'Erro ao atualizar perfil. Tente novamente.',
        }),
      })
    }
  }

  async function onChangePassword(formData: ChangePasswordFormData) {
    setPasswordMessage(null)
    try {
      await changePasswordMutation.mutateAsync({
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
        confirmNewPassword: formData.confirmNewPassword,
      })
      passwordForm.reset()
      setPasswordMessage('Senha alterada com sucesso.')
    } catch (error: unknown) {
      passwordForm.setError('root', {
        message: getApiErrorMessage(error, {
          defaultMessage: 'Erro ao alterar senha. Tente novamente.',
          invalidCredentialsMessage: 'Senha atual incorreta.',
        }),
      })
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Perfil</h1>
        <p className="text-sm text-muted-foreground">
          Atualize seus dados e mantenha sua conta segura.
        </p>
      </div>

      <section className="rounded-lg border bg-background p-6 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Dados pessoais</h2>
          <p className="text-sm text-muted-foreground">
            Email e data de cadastro são somente leitura.
          </p>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="profile-name">Nome</Label>
            <Input
              id="profile-name"
              placeholder="Seu nome"
              disabled={!isUserReady || updateProfileMutation.isPending}
              aria-invalid={!!profileForm.formState.errors.name}
              {...profileForm.register('name')}
            />
            {profileForm.formState.errors.name && (
              <p className="text-sm text-destructive">
                {profileForm.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-email">Email</Label>
            <Input
              id="profile-email"
              value={user?.email ?? ''}
              disabled
            />
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <Label htmlFor="profile-created">Cadastro</Label>
          <Input
            id="profile-created"
            value={createdAtLabel}
            disabled
          />
        </div>

        {profileForm.formState.errors.root?.message && (
          <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {profileForm.formState.errors.root.message}
          </div>
        )}
        {profileMessage && (
          <div className="mt-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">
            {profileMessage}
          </div>
        )}

        <div className="mt-6">
          <Button
            onClick={profileForm.handleSubmit(onUpdateProfile)}
            disabled={
              !isUserReady ||
              updateProfileMutation.isPending ||
              profileForm.formState.isSubmitting
            }
          >
            {updateProfileMutation.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </section>

      <section className="rounded-lg border bg-background p-6 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Alterar senha</h2>
          <p className="text-sm text-muted-foreground">
            Use uma senha forte e única.
          </p>
        </div>

        <form
          onSubmit={passwordForm.handleSubmit(onChangePassword)}
          className="mt-4 grid gap-4 md:grid-cols-2"
        >
          <div className="flex items-center gap-2 md:col-span-2">
            <input
              id="toggle-password-visibility"
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={showPasswords}
              onChange={(event) => setShowPasswords(event.target.checked)}
            />
            <Label htmlFor="toggle-password-visibility">
              Mostrar senhas
            </Label>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="current-password">Senha atual</Label>
            <Input
              id="current-password"
              type={showPasswords ? 'text' : 'password'}
              placeholder="••••••••"
              disabled={changePasswordMutation.isPending}
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
              disabled={changePasswordMutation.isPending}
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
              disabled={changePasswordMutation.isPending}
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
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive md:col-span-2">
              {passwordForm.formState.errors.root.message}
            </div>
          )}
          {passwordMessage && (
            <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700 md:col-span-2">
              {passwordMessage}
            </div>
          )}

          <div className="md:col-span-2">
            <Button
              type="submit"
              disabled={
                changePasswordMutation.isPending ||
                passwordForm.formState.isSubmitting
              }
            >
              {changePasswordMutation.isPending
                ? 'Atualizando...'
                : 'Atualizar senha'}
            </Button>
          </div>
        </form>
      </section>
    </div>
  )
}

function formatCreatedAt(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}
