import { createFileRoute } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"

export const Route = createFileRoute("/login")({
  component: () => (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold">Login</h1>
        <Button className="w-full">Entrar</Button>
      </div>
    </div>
  ),
})
