import {
  Outlet,
  createFileRoute,
  redirect,
} from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { Header } from '@/components/app/Header'
import { Sidebar } from '@/components/app/Sidebar'
import { isAuthenticated, setAuth, type User } from '@/features/auth'
import { api } from '@/lib/api'

export const Route = createFileRoute('/app')({
  beforeLoad: async () => {
    if (isAuthenticated()) {
      return
    }

    try {
      const refreshResponse = await api.post(
        '/auth/refresh',
        {},
        { withCredentials: true },
      )
      const { accessToken } = refreshResponse.data ?? {}

      if (!accessToken) {
        throw new Error('Missing access token')
      }

      const userResponse = await api.get<User>('/auth/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      setAuth(accessToken, userResponse.data)
    } catch {
      throw redirect({ to: '/login' })
    }
  },
  component: AppLayout,
})

function AppLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }
    const previousOverflow = document.body.style.overflow
    if (isSidebarOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = previousOverflow
    }
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isSidebarOpen])

  return (
    <div className="flex h-[100dvh] flex-col">
      <Header onMenuClick={() => setIsSidebarOpen(true)} />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
