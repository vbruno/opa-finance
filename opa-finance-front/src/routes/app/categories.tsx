import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/app/categories')({
  component: Categories,
})

function Categories() {
  return <h2 className="text-xl font-bold">Categories</h2>
}
