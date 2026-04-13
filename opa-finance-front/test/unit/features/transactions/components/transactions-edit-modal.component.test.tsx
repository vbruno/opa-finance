import { useForm } from 'react-hook-form'
import { describe, expect, it, vi } from 'vitest'

import { TransactionsEditModal } from '@/features/transactions/components/transactions-edit-modal'
import type { Transaction } from '@/features/transactions/transactions.api'
import type { TransactionCreateFormData } from '@/schemas/transaction.schema'
import { fireEvent, renderWithProviders, screen } from '../../../../setup/render'

const tx: Transaction = {
  id: 'tx-1',
  userId: 'user-1',
  accountId: 'acc-1',
  accountName: 'Conta Principal',
  categoryId: 'cat-1',
  categoryName: 'Habitação',
  subcategoryId: null,
  subcategoryName: null,
  type: 'expense',
  amount: 265,
  date: '2026-03-01',
  description: 'Aluguel',
  notes: null,
  transferId: null,
  createdAt: '2026-03-01T00:00:00.000Z',
}

function EditHarness({
  onClose,
}: {
  onClose: () => void
}) {
  const form = useForm<TransactionCreateFormData>({
    defaultValues: {
      accountId: 'acc-1',
      categoryId: 'cat-1',
      subcategoryId: '',
      type: 'expense',
      amount: '265',
      date: '2026-03-01',
      description: 'Aluguel',
      notes: '',
    },
  })

  return (
    <TransactionsEditModal
      isOpen={true}
      selectedTransaction={tx}
      editControl={form.control}
      editRegister={form.register}
      editErrors={form.formState.errors}
      clearEditErrors={() => {}}
      isEditFormSubmitting={false}
      editType="expense"
      isMobile={false}
      accounts={[]}
      isEditSubmitting={false}
      isEditAccountSelectOpen={false}
      setIsEditAccountSelectOpen={() => {}}
      isEditCategoryTreeOpen={false}
      editCategoryTreeSearch=""
      setEditCategoryTreeSearch={() => {}}
      editCategoryTreeOptions={[]}
      editCategoryTreeContentRef={{ current: null }}
      editCategoryTreeSearchInputRef={{ current: null }}
      editAmountRef={{ current: null }}
      getEditCategoryTreeValue={() => '__none__'}
      handleEditCategoryTreeValueChange={() => {}}
      handleEditCategoryTreeOpenChange={() => {}}
      handleEditCategoryTreeSearchKeyDown={() => {}}
      handleEditCategoryTreeItemKeyDown={() => {}}
      handleTransactionAmountChange={() => {}}
      onSubmit={(event) => event.preventDefault()}
      onClose={onClose}
      onDateFocus={() => {}}
      onDateClick={() => {}}
      onDateKeyDown={() => {}}
      onDatePaste={() => {}}
      createCategoryTreeNoneValue="__none__"
      createCategoryTreeCreateCategoryValue="__create_category__"
      createCategoryTreeCreateSubcategoryValue="__create_subcategory__"
    />
  )
}

describe('TransactionsEditModal', () => {
  it('deve renderizar e fechar pelo botão cancelar', () => {
    const onClose = vi.fn()
    renderWithProviders(<EditHarness onClose={onClose} />)

    expect(screen.getByText('Editar transação')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
