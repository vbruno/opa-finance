import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/app/transactions')({
  component: Transactions,
})

function Transactions() {
  return <h2 className="text-xl font-bold">Transactions</h2>
}
