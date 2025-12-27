import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  formatCurrencyInput,
  formatCurrencyValue,
  parseCurrencyInput,
} from '@/lib/utils'
import {
  accountCreateSchema,
  type AccountCreateFormData,
} from '@/schemas/account.schema'

export const Route = createFileRoute('/app/accounts')({
  component: Accounts,
})

function Accounts() {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    null,
  )

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AccountCreateFormData>({
    resolver: zodResolver(accountCreateSchema),
    defaultValues: {
      name: '',
      type: undefined,
      currentBalance: '',
      confirm: false,
    },
  })

  const confirmValue = watch('confirm')

  const {
    control: editControl,
    register: editRegister,
    handleSubmit: handleEditSubmit,
    reset: resetEdit,
    watch: watchEdit,
    formState: {
      errors: editErrors,
      isSubmitting: isEditSubmitting,
    },
  } = useForm<AccountCreateFormData>({
    resolver: zodResolver(accountCreateSchema),
    defaultValues: {
      name: '',
      type: undefined,
      currentBalance: '',
      confirm: false,
    },
  })

  const confirmEditValue = watchEdit('confirm')

  const [accounts, setAccounts] = useState([
    {
      id: 'acc-1',
      name: 'Conta Corrente',
      type: 'checking_account',
      currentBalance: 3580.45,
      createdAt: '2025-01-15T10:30:00.000Z',
    },
    {
      id: 'acc-2',
      name: 'Cartao de Credito',
      type: 'credit_card',
      currentBalance: -1240.9,
      createdAt: '2025-02-02T09:15:00.000Z',
    },
    {
      id: 'acc-3',
      name: 'Poupanca',
      type: 'savings_account',
      currentBalance: 12450,
      createdAt: '2025-03-20T14:05:00.000Z',
    },
  ])

  const dateFormatter = new Intl.DateTimeFormat('pt-BR')
  const selectedAccount = accounts.find(
    (account) => account.id === selectedAccountId,
  )

  const accountTypeLabels: Record<string, string> = {
    cash: 'Dinheiro',
    checking_account: 'Conta Corrente',
    savings_account: 'Poupanca',
    credit_card: 'Cartao de Credito',
    investment: 'Investimento',
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Contas</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie suas contas e acompanhe os saldos atuais.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              reset()
              setIsCreateOpen(true)
            }}
          >
            Nova conta
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-background p-4">
        <div className="flex-1">
          <label className="text-xs font-semibold uppercase text-muted-foreground">
            Buscar
          </label>
          <Input
            type="text"
            placeholder="Buscar por nome..."
            className="mt-2"
          />
        </div>
        <div className="w-full sm:w-56">
          <label className="text-xs font-semibold uppercase text-muted-foreground">
            Tipo
          </label>
          <select className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm">
            <option value="">Todos</option>
            <option value="checking_account">Conta Corrente</option>
            <option value="savings_account">Poupanca</option>
            <option value="credit_card">Cartao de Credito</option>
            <option value="investment">Investimento</option>
            <option value="cash">Dinheiro</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Conta</th>
              <th className="w-[1%] px-4 py-3 whitespace-nowrap">Tipo</th>
              <th className="w-[1%] px-4 py-3 text-right whitespace-nowrap">
                Saldo atual
              </th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr
                key={account.id}
                className="cursor-pointer border-t hover:bg-muted/30"
                onClick={() => setSelectedAccountId(account.id)}
              >
                <td className="px-4 py-3 font-medium">{account.name}</td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {accountTypeLabels[account.type] ?? account.type}
                </td>
                <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                  {`$ ${formatCurrencyValue(account.currentBalance)}`}
                </td>
              </tr>
            ))}
            {accounts.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">
                      Nenhuma conta cadastrada ainda.
                    </p>
                    <Button size="sm">Criar conta</Button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="fixed inset-0"
            onClick={() => setIsCreateOpen(false)}
          />
          <div className="relative w-full max-w-lg rounded-lg border bg-background p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Criar nova conta</h3>
                <p className="text-sm text-muted-foreground">
                  Preencha os dados basicos para adicionar uma conta.
                </p>
              </div>
            </div>

            <form
              className="mt-6 space-y-4"
              onSubmit={handleSubmit(() => {
                setIsCreateOpen(false)
                reset()
              })}
            >
              <div className="space-y-2">
                <Label htmlFor="account-name">Nome</Label>
                <Input
                  id="account-name"
                  placeholder="Ex: Conta Corrente"
                  className="h-10"
                  aria-invalid={!!errors.name}
                  {...register('name')}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">
                    {errors.name.message}
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="account-type">Tipo</Label>
                  <select
                    id="account-type"
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    aria-invalid={!!errors.type}
                    {...register('type')}
                  >
                    <option value="">Selecione</option>
                    <option value="checking_account">Conta Corrente</option>
                    <option value="savings_account">Poupanca</option>
                    <option value="credit_card">Cartao de Credito</option>
                    <option value="investment">Investimento</option>
                    <option value="cash">Dinheiro</option>
                  </select>
                  {errors.type && (
                    <p className="text-sm text-destructive">
                      {errors.type.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="account-balance">Saldo atual</Label>
                  <Controller
                    control={control}
                    name="currentBalance"
                    render={({ field }) => (
                      <Input
                        id="account-balance"
                        type="text"
                        inputMode="numeric"
                        placeholder="$ 0,00"
                        value={field.value}
                        onChange={(event) =>
                          field.onChange(
                            formatCurrencyInput(event.target.value),
                          )
                        }
                        className="h-10"
                        aria-invalid={!!errors.currentBalance}
                      />
                    )}
                  />
                  {errors.currentBalance && (
                    <p className="text-sm text-destructive">
                      {errors.currentBalance.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    {...register('confirm')}
                  />
                  Confirmo que os dados estao corretos
                </label>
                <Button type="submit" disabled={!confirmValue || isSubmitting}>
                  {isSubmitting ? 'Criando...' : 'Criar conta'}
                </Button>
              </div>
              {errors.confirm && (
                <p className="text-sm text-destructive">{errors.confirm.message}</p>
              )}
            </form>
          </div>
        </div>
      )}

      {selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="fixed inset-0"
            onClick={() => setSelectedAccountId(null)}
          />
          <div className="relative w-full max-w-lg rounded-lg border bg-background p-6 shadow-lg">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">{selectedAccount.name}</h3>
              <p className="text-sm text-muted-foreground">
                Detalhes da conta
              </p>
            </div>

            <div className="mt-6 grid gap-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Tipo</span>
                <span className="font-medium">
                  {accountTypeLabels[selectedAccount.type] ??
                    selectedAccount.type}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Saldo atual</span>
                <span className="font-semibold">
                  {`$ ${formatCurrencyValue(selectedAccount.currentBalance)}`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Criada em</span>
                <span className="font-medium">
                  {dateFormatter.format(new Date(selectedAccount.createdAt))}
                </span>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  resetEdit({
                    name: selectedAccount.name,
                    type: selectedAccount.type,
                    currentBalance: formatCurrencyInput(
                      String(selectedAccount.currentBalance),
                    ),
                    confirm: false,
                  })
                  setIsEditOpen(true)
                }}
              >
                Editar
              </Button>
            </div>
          </div>
        </div>
      )}

      {isEditOpen && selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="fixed inset-0" onClick={() => setIsEditOpen(false)} />
          <div className="relative w-full max-w-lg rounded-lg border bg-background p-6 shadow-lg">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">Editar conta</h3>
              <p className="text-sm text-muted-foreground">
                Atualize as informacoes da conta selecionada.
              </p>
            </div>

            <form
              className="mt-6 space-y-4"
              onSubmit={handleEditSubmit((formData) => {
                const parsedBalance = parseCurrencyInput(formData.currentBalance)
                setAccounts((current) =>
                  current.map((account) =>
                    account.id === selectedAccount.id
                      ? {
                          ...account,
                          name: formData.name,
                          type: formData.type,
                          currentBalance: parsedBalance ?? account.currentBalance,
                        }
                      : account,
                  ),
                )
                setIsEditOpen(false)
                resetEdit()
              })}
            >
              <div className="space-y-2">
                <Label htmlFor="edit-account-name">Nome</Label>
                <Input
                  id="edit-account-name"
                  placeholder="Ex: Conta Corrente"
                  className="h-10"
                  aria-invalid={!!editErrors.name}
                  {...editRegister('name')}
                />
                {editErrors.name && (
                  <p className="text-sm text-destructive">
                    {editErrors.name.message}
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-account-type">Tipo</Label>
                  <select
                    id="edit-account-type"
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    aria-invalid={!!editErrors.type}
                    {...editRegister('type')}
                  >
                    <option value="">Selecione</option>
                    <option value="checking_account">Conta Corrente</option>
                    <option value="savings_account">Poupanca</option>
                    <option value="credit_card">Cartao de Credito</option>
                    <option value="investment">Investimento</option>
                    <option value="cash">Dinheiro</option>
                  </select>
                  {editErrors.type && (
                    <p className="text-sm text-destructive">
                      {editErrors.type.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-account-balance">Saldo atual</Label>
                  <Controller
                    control={editControl}
                    name="currentBalance"
                    render={({ field }) => (
                      <Input
                        id="edit-account-balance"
                        type="text"
                        inputMode="numeric"
                        placeholder="$ 0,00"
                        value={field.value}
                        onChange={(event) =>
                          field.onChange(
                            formatCurrencyInput(event.target.value),
                          )
                        }
                        className="h-10"
                        aria-invalid={!!editErrors.currentBalance}
                      />
                    )}
                  />
                  {editErrors.currentBalance && (
                    <p className="text-sm text-destructive">
                      {editErrors.currentBalance.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    {...editRegister('confirm')}
                  />
                  Confirmo que os dados estao corretos
                </label>
                <Button
                  type="submit"
                  disabled={!confirmEditValue || isEditSubmitting}
                >
                  {isEditSubmitting ? 'Salvando...' : 'Salvar alteracoes'}
                </Button>
              </div>
              {editErrors.confirm && (
                <p className="text-sm text-destructive">
                  {editErrors.confirm.message}
                </p>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
