import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/")({
  component: () => (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Home</h1>
    </div>
  ),
})
