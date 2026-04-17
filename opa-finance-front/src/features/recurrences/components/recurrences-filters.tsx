import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Account } from '@/features/accounts'
import type {
  RecurrencesSearchParams,
  RecurrencesSetSearchInput,
} from '@/features/recurrences/model/recurrences.types'

type RecurrencesFiltersProps = {
  search: RecurrencesSearchParams
  accounts: Account[]
  onSetSearch: (next: RecurrencesSetSearchInput) => void
}

export function RecurrencesFilters({
  search,
  accounts,
  onSetSearch,
}: RecurrencesFiltersProps) {
  return (
    <div className="rounded-lg border p-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
        <Input
          placeholder="Buscar por descrição/nota"
          value={search.q ?? ''}
          onChange={(event) =>
            onSetSearch({ page: 1, q: event.target.value || undefined })
          }
          className="md:col-span-2"
        />

        <Select
          value={search.originType ?? '__all__'}
          onValueChange={(value) =>
            onSetSearch({
              page: 1,
              originType:
                value === '__all__' ? undefined : (value as 'transaction' | 'transfer'),
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Tipo de origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas as origens</SelectItem>
            <SelectItem value="transaction">Transação</SelectItem>
            <SelectItem value="transfer">Transferência</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={search.status ?? '__all__'}
          onValueChange={(value) =>
            onSetSearch({
              page: 1,
              status: value === '__all__' ? undefined : (value as 'active' | 'finalized'),
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os status</SelectItem>
            <SelectItem value="active">Em execução</SelectItem>
            <SelectItem value="finalized">Finalizada</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={search.frequency ?? '__all__'}
          onValueChange={(value) =>
            onSetSearch({
              page: 1,
              frequency:
                value === '__all__'
                  ? undefined
                  : (value as 'weekly' | 'biweekly' | 'monthly' | 'yearly'),
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Frequência" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas as frequências</SelectItem>
            <SelectItem value="weekly">Semanal</SelectItem>
            <SelectItem value="biweekly">Quinzenal</SelectItem>
            <SelectItem value="monthly">Mensal</SelectItem>
            <SelectItem value="yearly">Anual</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={search.accountId ?? '__all__'}
          onValueChange={(value) =>
            onSetSearch({ page: 1, accountId: value === '__all__' ? undefined : value })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Conta" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas as contas</SelectItem>
            {accounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant="outline"
          onClick={() =>
            onSetSearch({
              page: 1,
              q: undefined,
              originType: undefined,
              status: undefined,
              frequency: undefined,
              accountId: undefined,
            })
          }
        >
          Limpar filtros
        </Button>
      </div>
    </div>
  )
}
