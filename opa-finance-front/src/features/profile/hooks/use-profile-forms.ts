import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'

import {
  updateUser,
  useChangePassword,
  type User,
} from '@/features/auth'
import {
  PROFILE_ERROR_MESSAGES,
  PROFILE_SUCCESS_MESSAGES,
} from '@/features/profile/model/profile.constants'
import { getApiErrorMessage } from '@/lib/apiError'
import {
  changePasswordSchema,
  updateProfileSchema,
  type ChangePasswordFormData,
  type UpdateProfileFormData,
} from '@/schemas/user.schema'

import {
  buildUpdateProfilePayload,
  toProfileFormValues,
} from '../mappers/profile.mapper'
import { useUpdateProfile } from '../profile.api'

type UseProfileFormsInput = {
  user: User | null
  onUserUpdated: (user: User) => void
}

export function useProfileForms({ user, onUserUpdated }: UseProfileFormsInput) {
  const [profileMessage, setProfileMessage] = useState<string | null>(null)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)
  const [showPasswords, setShowPasswords] = useState(false)

  const profileForm = useForm<UpdateProfileFormData>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: toProfileFormValues(user),
  })

  const passwordForm = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmNewPassword: '',
    },
  })

  useEffect(() => {
    profileForm.reset(toProfileFormValues(user))
  }, [profileForm, user])

  const updateProfileMutation = useUpdateProfile()
  const changePasswordMutation = useChangePassword()

  async function onUpdateProfile(formData: UpdateProfileFormData) {
    setProfileMessage(null)
    try {
      if (!user) {
        throw new Error(PROFILE_ERROR_MESSAGES.missingUser)
      }

      const payload = buildUpdateProfilePayload({
        userId: user.id,
        values: {
          name: formData.name,
          timezone: formData.timezone,
        },
      })
      const updatedUser = await updateProfileMutation.mutateAsync(payload)

      updateUser(updatedUser)
      onUserUpdated(updatedUser)

      profileForm.reset(toProfileFormValues(updatedUser))
      setProfileMessage(PROFILE_SUCCESS_MESSAGES.profileUpdated)
    } catch (error: unknown) {
      profileForm.setError('root', {
        message: getApiErrorMessage(error, {
          defaultMessage: PROFILE_ERROR_MESSAGES.profileUpdateDefault,
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
      setPasswordMessage(PROFILE_SUCCESS_MESSAGES.passwordUpdated)
    } catch (error: unknown) {
      passwordForm.setError('root', {
        message: getApiErrorMessage(error, {
          defaultMessage: PROFILE_ERROR_MESSAGES.passwordUpdateDefault,
          invalidCredentialsMessage: PROFILE_ERROR_MESSAGES.invalidCredentials,
        }),
      })
    }
  }

  return {
    profileForm,
    passwordForm,
    updateProfileMutation,
    changePasswordMutation,
    profileMessage,
    passwordMessage,
    showPasswords,
    setShowPasswords,
    onUpdateProfile,
    onChangePassword,
  }
}
