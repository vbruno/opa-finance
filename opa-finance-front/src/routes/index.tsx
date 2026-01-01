import { createFileRoute, redirect } from '@tanstack/react-router'

import { isAuthenticated } from '@/features/auth'

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    if (isAuthenticated()) {
      throw redirect({ to: '/app' })
    }

    throw redirect({ to: '/login' })
  },
})
