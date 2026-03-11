import { createFileRoute } from '@tanstack/react-router'
import { BarChart3 } from 'lucide-react'
import { useMemo } from 'react'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAccounts } from '@/features/accounts'
import { useTrialBalance, type TrialBalanceLine } from '@/features/reports'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatCurrencyValue } from '@/lib/utils'

const monthLabels = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
]

export const Route = createFileRoute('/app/trial-balance')({
  validateSearch: z.object({
    year: z.coerce.number().int().min(2000).max(2100).optional(),
    accountIds: z.string().optional(),
  }),
  component: TrialBalancePage,
})

function TrialBalancePage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const isDesktop = useMediaQuery('(min-width: 960px)')
  const currentYear = new Date().getFullYear()
  const year = search.year ?? currentYear

  const accountsQuery = useAccounts()
  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data])
  const allAccountIds = useMemo(() => accounts.map((account) => account.id), [accounts])

  const selectedAccountIds = useMemo(() => {
    if (!search.accountIds) {
      return null
    }
    const ids = search.accountIds
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
    return ids.length ? ids : null
  }, [search.accountIds])

  const sanitizedAccountIds = useMemo(() => {
    if (!selectedAccountIds) {
      return null
    }
    if (!allAccountIds.length) {
      return selectedAccountIds
    }
    const validIds = new Set(allAccountIds)
    const filtered = selectedAccountIds.filter((id) => validIds.has(id))
    if (!filtered.length || filtered.length === allAccountIds.length) {
      return null
    }
    return allAccountIds.filter((id) => filtered.includes(id))
  }, [allAccountIds, selectedAccountIds])

  const trialBalanceQuery = useTrialBalance(
    {
      year,
      accountIds: sanitizedAccountIds ?? undefined,
    },
    {
      enabled: isDesktop,
    },
  )

  function setSearch(
    next: Partial<{
      year: number
      accountIds: string | undefined
    }>,
  ) {
    navigate({
      search: (prev) => ({
        ...prev,
        ...next,
      }),
      replace: true,
    })
  }

  function updateSelectedAccounts(nextIds: string[] | null) {
    if (!nextIds || nextIds.length === 0 || nextIds.length === allAccountIds.length) {
      setSearch({ accountIds: undefined })
      return
    }
    setSearch({ accountIds: nextIds.join(',') })
  }

  function toggleAccount(accountId: string) {
    if (!allAccountIds.length) {
      return
    }
    if (!sanitizedAccountIds) {
      updateSelectedAccounts(allAccountIds.filter((id) => id !== accountId))
      return
    }
    const selectedSet = new Set(sanitizedAccountIds)
    if (selectedSet.has(accountId)) {
      selectedSet.delete(accountId)
    } else {
      selectedSet.add(accountId)
    }
    const nextIds = allAccountIds.filter((id) => selectedSet.has(id))
    updateSelectedAccounts(nextIds)
  }

  if (!isDesktop) {
    return (
      <div className="rounded-md border p-4">
        <h1 className="text-lg font-semibold">Balancete</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A visualização de balancete está disponível na versão desktop.
        </p>
      </div>
    )
  }

  const selectedIdsForUi = sanitizedAccountIds ?? allAccountIds
  const isEmpty =
    !trialBalanceQuery.isLoading &&
    !trialBalanceQuery.isError &&
    ((trialBalanceQuery.data?.income.length ?? 0) === 0 &&
      (trialBalanceQuery.data?.expense.length ?? 0) === 0)

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="rounded-md border p-2">
          <BarChart3 className="size-4" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Balancete</h1>
          <p className="text-sm text-muted-foreground">
            Visão anual de receitas e despesas por categoria e subcategoria.
          </p>
        </div>
      </div>

      <section className="space-y-3 rounded-lg border p-3">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[180px_1fr]">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Ano</label>
            <Input
              type="number"
              min={2000}
              max={2100}
              value={year}
              onChange={(event) => {
                const nextYear = Number(event.target.value)
                if (Number.isFinite(nextYear) && nextYear >= 2000 && nextYear <= 2100) {
                  setSearch({ year: nextYear })
                }
              }}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs text-muted-foreground">Contas</label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateSelectedAccounts(null)}
                disabled={accountsQuery.isLoading || accounts.length === 0}
              >
                Todas
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {accounts.map((account) => {
                const isSelected = selectedIdsForUi.includes(account.id)
                return (
                  <Button
                    key={account.id}
                    type="button"
                    variant={isSelected ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => toggleAccount(account.id)}
                    disabled={accountsQuery.isLoading}
                  >
                    {account.name}
                  </Button>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {accountsQuery.isLoading ? (
        <div className="rounded-lg border p-4 text-sm text-muted-foreground">
          Carregando contas...
        </div>
      ) : null}

      {accountsQuery.isError ? (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-500">
          {getApiErrorMessage(accountsQuery.error)}
        </div>
      ) : null}

      {trialBalanceQuery.isLoading ? (
        <div className="rounded-lg border p-4 text-sm text-muted-foreground">
          Carregando balancete...
        </div>
      ) : null}

      {trialBalanceQuery.isError ? (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-500">
          {getApiErrorMessage(trialBalanceQuery.error)}
        </div>
      ) : null}

      {isEmpty ? (
        <div className="rounded-lg border p-4 text-sm text-muted-foreground">
          Não há dados para o ano selecionado.
        </div>
      ) : null}

      {!trialBalanceQuery.isLoading && !trialBalanceQuery.isError && trialBalanceQuery.data ? (
        <div className="rounded-lg border">
          <div className="overflow-x-auto">
            <table className="min-w-[1100px] border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="px-3 py-2 font-medium">Tipo / Categoria</th>
                  {monthLabels.map((label) => (
                    <th key={label} className="px-2 py-2 text-right font-medium">
                      {label}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right font-semibold">Total/Ano</th>
                </tr>
              </thead>

              <tbody>
                <SectionRows
                  title="Receitas"
                  data={trialBalanceQuery.data.income}
                  totals={trialBalanceQuery.data.totals.income}
                />
                <SectionRows
                  title="Despesas"
                  data={trialBalanceQuery.data.expense}
                  totals={trialBalanceQuery.data.totals.expense}
                />
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function SectionRows({
  title,
  data,
  totals,
}: {
  title: string
  data: TrialBalanceLine[]
  totals: { months: number[]; yearTotal: number }
}) {
  return (
    <>
      <tr className="border-y bg-muted/20">
        <td className="px-3 py-2 font-semibold">{title}</td>
        {totals.months.map((value, index) => (
          <td key={`${title}-head-${index}`} className="px-2 py-2 text-right font-semibold">
            {formatBalanceCell(value)}
          </td>
        ))}
        <td className="px-3 py-2 text-right font-bold">{formatBalanceCell(totals.yearTotal)}</td>
      </tr>

      {data.map((category) => (
        <CategoryRows key={category.categoryId} category={category} />
      ))}

      <tr className="border-y bg-muted/30">
        <td className="px-3 py-2 font-bold">{`Total geral ${title.toLowerCase()}`}</td>
        {totals.months.map((value, index) => (
          <td key={`${title}-total-${index}`} className="px-2 py-2 text-right font-bold">
            {formatBalanceCell(value)}
          </td>
        ))}
        <td className="px-3 py-2 text-right font-bold">{formatBalanceCell(totals.yearTotal)}</td>
      </tr>
    </>
  )
}

function CategoryRows({ category }: { category: TrialBalanceLine }) {
  return (
    <>
      <tr className="border-b bg-muted/10">
        <td className="px-3 py-2 font-medium">{category.categoryName}</td>
        {category.months.map((value, index) => (
          <td key={`${category.categoryId}-month-${index}`} className="px-2 py-2 text-right font-medium">
            {formatBalanceCell(value)}
          </td>
        ))}
        <td className="px-3 py-2 text-right font-semibold">
          {formatBalanceCell(category.yearTotal)}
        </td>
      </tr>

      {category.subcategories.map((subcategory) => (
        <tr key={subcategory.subcategoryId} className="border-b">
          <td className="px-3 py-2 text-muted-foreground">{`↳ ${subcategory.subcategoryName}`}</td>
          {subcategory.months.map((value, index) => (
            <td
              key={`${subcategory.subcategoryId}-month-${index}`}
              className="px-2 py-2 text-right text-muted-foreground"
            >
              {formatBalanceCell(value)}
            </td>
          ))}
          <td className="px-3 py-2 text-right text-muted-foreground">
            {formatBalanceCell(subcategory.yearTotal)}
          </td>
        </tr>
      ))}
    </>
  )
}

function formatBalanceCell(value: number) {
  if (!Number.isFinite(value) || value === 0) {
    return '-'
  }
  return `$ ${formatCurrencyValue(value)}`
}
