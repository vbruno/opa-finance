import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { login } from "@/auth/auth.store"
import { Button } from "@/components/ui/button"

export const Route = createFileRoute("/login")({
  component: Login,
})

function Login() {
  const navigate = useNavigate()

  function handleLogin() {
    login()
    navigate({ to: "/app" })
  }

  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold">Login</h1>
        <Button className="w-full" onClick={handleLogin}>
          Entrar
        </Button>
      </div>
    </div>
  )
}
