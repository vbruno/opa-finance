import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/app/accounts/$id')({
  component: AccountDetails,
})

function AccountDetails() {
  const { id } = Route.useParams()

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Detalhes da conta</h2>
        <p className="text-sm text-muted-foreground">
          ID da conta: {id}
        </p>
      </div>

      <div className="rounded-lg border bg-background p-6 text-sm text-muted-foreground">
        Placeholder do detalhe. Aqui vamos exibir saldo, transacoes recentes e
        configuracoes da conta.
      </div>
    </div>
  )
}
