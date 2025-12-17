import {
  Outlet,
  createFileRoute,
  redirect,
} from '@tanstack/react-router'

import { getUser } from '@/auth/auth.store'
import { Header } from '@/components/app/Header'

export const Route = createFileRoute('/app')({
  beforeLoad: () => {
    if (!getUser()) {
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
        <aside className="w-64 border-r p-4">
          <p className="font-medium">Menu</p>
        </aside>

        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
