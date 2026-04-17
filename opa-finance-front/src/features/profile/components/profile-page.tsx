import { useState } from 'react'

import { getUser, type User } from '@/features/auth'
import { ProfilePasswordSection } from '@/features/profile/components/profile-password-section'
import { ProfilePersonalSection } from '@/features/profile/components/profile-personal-section'
import { useProfileForms } from '@/features/profile/hooks/use-profile-forms'
import { useProfileTimezoneCatalog } from '@/features/profile/hooks/use-profile-timezone-catalog'
import { PROFILE_DEFAULT_TIMEZONE } from '@/features/profile/model/profile.constants'
import { formatProfileCreatedAt } from '@/features/profile/model/profile.helpers'

export function ProfilePage() {
  const [user, setUser] = useState<User | null>(() => getUser())
  const [timezoneSearch, setTimezoneSearch] = useState('')

  const isUserReady = !!user
  const createdAtLabel = formatProfileCreatedAt(user?.createdAt)

  const {
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
  } = useProfileForms({
    user,
    onUserUpdated: setUser,
  })

  const selectedTimezone = user?.timezone ?? PROFILE_DEFAULT_TIMEZONE
  const profileTimezoneValue = profileForm.watch('timezone') || selectedTimezone

  const {
    browserTimezone,
    userTimezonesQuery,
    filteredTimezoneOptions,
    timezoneOptionsForSelect,
  } = useProfileTimezoneCatalog({
    enabled: isUserReady,
    search: timezoneSearch,
    currentTimezone: profileTimezoneValue,
  })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Perfil</h1>
        <p className="text-sm text-muted-foreground">
          Atualize seus dados e mantenha sua conta segura.
        </p>
      </div>

      <ProfilePersonalSection
        isUserReady={isUserReady}
        userEmail={user?.email ?? ''}
        createdAtLabel={createdAtLabel}
        browserTimezone={browserTimezone}
        timezoneSearch={timezoneSearch}
        timezoneOptionsForSelect={timezoneOptionsForSelect}
        filteredTimezoneOptionsLength={filteredTimezoneOptions.length}
        isTimezoneCatalogError={userTimezonesQuery.isError}
        profileMessage={profileMessage}
        isUpdatingProfile={updateProfileMutation.isPending}
        profileForm={profileForm}
        onTimezoneSearchChange={setTimezoneSearch}
        onUseAutodetectedTimezone={() =>
          profileForm.setValue('timezone', browserTimezone, {
            shouldDirty: true,
            shouldTouch: true,
          })
        }
        onSubmit={() => {
          void profileForm.handleSubmit(onUpdateProfile)()
        }}
      />

      <ProfilePasswordSection
        showPasswords={showPasswords}
        passwordMessage={passwordMessage}
        isUpdatingPassword={changePasswordMutation.isPending}
        passwordForm={passwordForm}
        onToggleShowPasswords={setShowPasswords}
        onSubmit={(event) => {
          void passwordForm.handleSubmit(onChangePassword)(event)
        }}
      />
    </div>
  )
}
