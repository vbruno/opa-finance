import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/app/")({
  component: () => (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Área logada</h1>
    </div>
  ),
})
