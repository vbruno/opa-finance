import {
  Outlet,
  createFileRoute,
  redirect,
} from "@tanstack/react-router"

import { getUser } from "@/auth/auth.store"

export const Route = createFileRoute("/app")({
  beforeLoad: () => {
    if (!getUser()) {
      throw redirect({
        to: "/login",
      })
    }
  },
  component: AppLayout,
})

function AppLayout() {
  return (
    <div className="flex min-h-dvh">
      <aside className="w-64 border-r p-4">
        <h2 className="font-bold">Opa Finance</h2>
      </aside>

      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  )
}
