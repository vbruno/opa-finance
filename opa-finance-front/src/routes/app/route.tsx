import {
  Outlet,
  createFileRoute,
  redirect,
} from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { isAuthenticated } from '@/features/auth'
import { Header } from '@/components/app/Header'
import { Sidebar } from '@/components/app/Sidebar'

export const Route = createFileRoute('/app')({
  beforeLoad: () => {
    if (!isAuthenticated()) {
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
    <div className="flex min-h-dvh flex-col">
      <Header onMenuClick={() => setIsSidebarOpen(true)} />

      <div className="flex flex-1">
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
