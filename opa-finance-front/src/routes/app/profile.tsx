import { createFileRoute } from '@tanstack/react-router'

import { ProfilePage } from '@/features/profile/components/profile-page'

export const Route = createFileRoute('/app/profile')({
  component: ProfileRoute,
})

function ProfileRoute() {
  return <ProfilePage />
}
