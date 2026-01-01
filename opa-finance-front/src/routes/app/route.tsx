import {
  Outlet,
  createFileRoute,
  redirect,
} from '@tanstack/react-router'

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
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />

      <div className="flex flex-1">
        <Sidebar />

        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
