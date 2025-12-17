import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/app/accounts')({
  component: Accounts,
})

function Accounts() {
  return <h2 className="text-xl font-bold">Accounts</h2>
}
