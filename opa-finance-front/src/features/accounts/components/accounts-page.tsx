import { zodResolver } from '@hookform/resolvers/zod'
import { SlidersHorizontal } from 'lucide-react'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { ShortcutLabel, ShortcutTooltip } from '@/components/ui/shortcut-hint'
import {
  useAccounts,
  useCreateAccount,
  useDeleteAccount,
  useUpdateAccount,
} from '@/features/accounts'
import { AccountCreateModal } from '@/features/accounts/components/account-create-modal'
import { AccountDeleteConfirmModal } from '@/features/accounts/components/account-delete-confirm-modal'
import { AccountDetailsModal } from '@/features/accounts/components/account-details-modal'
import { AccountEditModal } from '@/features/accounts/components/account-edit-modal'
import { AccountPrimaryConfirmModal } from '@/features/accounts/components/account-primary-confirm-modal'
import { AccountsDesktopTable } from '@/features/accounts/components/accounts-desktop-table'
import { AccountsFiltersPanel } from '@/features/accounts/components/accounts-filters-panel'
import { AccountsMobileList } from '@/features/accounts/components/accounts-mobile-list'
import { AccountsPagination } from '@/features/accounts/components/accounts-pagination'
import { useAccountsDeleteAction } from '@/features/accounts/hooks/use-accounts-delete-action'
import { useAccountsFormActions } from '@/features/accounts/hooks/use-accounts-form-actions'
import { useAccountsLinkedActions } from '@/features/accounts/hooks/use-accounts-linked-actions'
import { useAccountsPageActions } from '@/features/accounts/hooks/use-accounts-page-actions'
import { useAccountsPageController } from '@/features/accounts/hooks/use-accounts-page-controller'
import { useAccountsPageInteractions } from '@/features/accounts/hooks/use-accounts-page-interactions'
import { useAccountsSearchParams } from '@/features/accounts/hooks/use-accounts-search-params'
import { useAccountsSelection } from '@/features/accounts/hooks/use-accounts-selection'
import { ACCOUNT_TYPE_LABELS } from '@/features/accounts/model/accounts.constants'
import {
  filterAccounts,
  paginateAccounts,
  resolveAccountsDisplayedTotal,
  sortAccounts,
} from '@/features/accounts/model/accounts.helpers'
import {
  type AccountsNavigateFn,
  type AccountsSearchParams,
} from '@/features/accounts/model/accounts.types'
import { useUserPreference } from '@/hooks/useUserPreference'
import {
  accountCreateSchema,
  accountUpdateSchema,
  type AccountCreateFormData,
  type AccountUpdateFormData,
} from '@/schemas/account.schema'

type AccountsPageProps = {
  search: AccountsSearchParams
  navigate: AccountsNavigateFn
}

export function AccountsPage({ search, navigate }: AccountsPageProps) {
  const controller = useAccountsPageController()
  const dateFormatter = new Intl.DateTimeFormat('pt-BR')

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AccountCreateFormData>({
    resolver: zodResolver(accountCreateSchema),
    defaultValues: {
      name: '',
      type: undefined,
      confirm: false,
    },
  })
  const confirmValue = watch('confirm')
  const createNameField = register('name')
  const createTypeField = register('type')
  const createConfirmField = register('confirm')

  const {
    register: editRegister,
    handleSubmit: handleEditSubmit,
    reset: resetEdit,
    watch: watchEdit,
    setError: setEditError,
    formState: { errors: editErrors, isSubmitting: isEditSubmitting },
  } = useForm<AccountUpdateFormData>({
    resolver: zodResolver(accountUpdateSchema),
    defaultValues: {
      name: '',
      type: undefined,
      confirm: false,
    },
  })
  const confirmEditValue = watchEdit('confirm')
  const editNameField = editRegister('name')
  const editTypeField = editRegister('type')
  const editConfirmField = editRegister('confirm')

  const accountsQuery = useAccounts()
  const createAccountMutation = useCreateAccount()
  const updateAccountMutation = useUpdateAccount()
  const deleteAccountMutation = useDeleteAccount()

  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data])
  const isRefreshingAccounts =
    accountsQuery.isFetching && !accountsQuery.isLoading
  const {
    searchTerm,
    searchDraft,
    setSearchDraft,
    typeFilter,
    selectedAccountId,
    sortKey,
    sortDirection,
    currentPage,
    hasActiveFilters,
    normalizedSearch,
    handleSearchEnter,
    handleTypeFilterChange,
    handleClearFilters,
  } = useAccountsSearchParams({
    search,
    navigate,
  })

  const selectedAccount =
    accounts.find((account) => account.id === selectedAccountId) ?? null
  const accountTypeLabels: Record<string, string> = ACCOUNT_TYPE_LABELS
  const filteredAccounts = filterAccounts(accounts, searchTerm, typeFilter)
  const totalFilteredBalance = filteredAccounts.reduce(
    (total, account) => total + (account.currentBalance ?? 0),
    0,
  )
  const sortedAccounts = sortAccounts(
    filteredAccounts,
    sortKey,
    sortDirection,
    accountTypeLabels,
  )

  const {
    isPrimaryConfirmOpen,
    isTogglingDashboardVisibility,
    dashboardVisibilityError,
    isSettingPrimary,
    primaryError,
    openPrimaryConfirm,
    closePrimaryConfirm,
    resetLinkedErrors,
    handleSetPrimaryAccount,
    handleToggleDashboardVisibility,
  } = useAccountsLinkedActions({
    selectedAccount,
    actions: {
      updateAccount: updateAccountMutation.mutateAsync,
    },
  })

  const {
    openAccountEdit,
    submitCreateAccount: onSubmitCreateAccount,
    submitEditAccount: onSubmitEditAccount,
  } = useAccountsFormActions({
    selectedAccount,
    services: {
      createAccount: createAccountMutation.mutateAsync,
      updateAccount: updateAccountMutation.mutateAsync,
    },
    forms: {
      resetCreateForm: reset,
      resetEditForm: resetEdit,
      setCreateFormError: setError,
      setEditFormError: setEditError,
    },
    modalActions: {
      openEditModal: controller.openEditModal,
      closeCreateModal: controller.closeCreateModal,
      closeEditModal: controller.closeEditModal,
    },
    navigate,
  })

  const [pageSize, setPageSize] = useUserPreference<number>(
    'accountsPageSize',
    10,
    {
      serialize: (value) => String(value),
      deserialize: (raw) => {
        const parsed = Number(raw)
        if (!Number.isFinite(parsed) || parsed <= 0) {
          return 10
        }
        return Math.min(50, Math.max(5, Math.floor(parsed)))
      },
    },
  )

  const { totalPages, safePage, paginatedAccounts } = paginateAccounts(
    sortedAccounts,
    currentPage,
    pageSize,
  )

  const hasOpenModal =
    controller.isCreateOpen ||
    controller.isEditOpen ||
    controller.isDeleteConfirmOpen ||
    !!selectedAccount

  const {
    selectedAccountIds,
    selectedCount,
    selectedTotal,
    allSelectedOnPage,
    selectAllRef,
    toggleSelectAllOnPage,
    toggleSelectAccount,
    setAccountSelected,
  } = useAccountsSelection({
    accounts,
    filteredAccounts,
    paginatedAccounts,
    normalizedSearch,
    typeFilter,
    hasOpenModal,
  })

  const displayedTotal = resolveAccountsDisplayedTotal({
    selectedCount,
    selectedTotal,
    totalFilteredBalance,
  })

  const {
    deleteError,
    deleteBlockedReason,
    setDeleteError,
    setDeleteBlockedReason,
    resetDeleteFeedback,
    submitDeleteAccount,
  } = useAccountsDeleteAction({
    selectedAccountId: selectedAccount?.id ?? null,
    actions: {
      deleteAccount: deleteAccountMutation.mutateAsync,
      navigate,
      closeDeleteConfirmModal: controller.closeDeleteConfirmModal,
    },
  })

  const openAccountDeleteConfirm = () => {
    resetDeleteFeedback()
    controller.openDeleteConfirmModal()
  }

  const submitCreateAccount = handleSubmit(onSubmitCreateAccount)
  const submitEditAccount = handleEditSubmit(onSubmitEditAccount)
  const {
    openAccountById,
    closeAccountDetails,
    closeEditModal,
    openCreateModal,
    handleSort,
    handlePageSizeChange,
    goToFirstPage,
    goToPreviousPage,
    goToNextPage,
    goToLastPage,
  } = useAccountsPageActions({
    navigate,
    safePage,
    totalPages,
    setPageSize,
    resetCreateForm: reset,
    openCreateModalState: controller.openCreateModal,
    closeEditModalState: controller.closeEditModal,
  })

  useAccountsPageInteractions({
    pagination: {
      currentPage,
      totalPages,
    },
    selection: {
      selectedAccountId,
      selectedAccount: selectedAccount ?? undefined,
      isAccountsLoading: accountsQuery.isLoading,
    },
    modalState: {
      hasOpenModal,
      isCreateOpen: controller.isCreateOpen,
      isEditOpen: controller.isEditOpen,
      isDeleteConfirmOpen: controller.isDeleteConfirmOpen,
      isPrimaryConfirmOpen,
      isTogglingDashboardVisibility,
      isSettingPrimary,
    },
    modalSetters: {
      setIsCreateOpen: controller.setIsCreateOpen,
      setIsEditOpen: controller.setIsEditOpen,
      setIsDeleteConfirmOpen: controller.setIsDeleteConfirmOpen,
    },
    refs: {
      createNameRef: controller.createNameRef,
      editNameRef: controller.editNameRef,
      detailModalRef: controller.detailModalRef,
      deleteModalRef: controller.deleteModalRef,
    },
    actions: {
      navigate,
      resetLinkedErrors,
      setDeleteError,
      setDeleteBlockedReason,
      resetCreateForm: reset,
      openAccountDeleteConfirm,
      openAccountEdit,
      openPrimaryConfirm,
      closePrimaryConfirm,
      handleToggleDashboardVisibility,
      submitCreateAccount,
      submitEditAccount,
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Contas</h2>
          {isRefreshingAccounts && (
            <p className="text-xs text-muted-foreground">Atualizando saldos...</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant={
              hasActiveFilters || controller.isFiltersOpen ? 'secondary' : 'outline'
            }
            size="icon"
            className="h-10 w-10 sm:hidden"
            aria-label={controller.isFiltersOpen ? 'Ocultar filtros' : 'Mostrar filtros'}
            onClick={controller.toggleFilters}
          >
            <SlidersHorizontal className="size-4" />
          </Button>
          <ShortcutTooltip label="Atalho: N">
            <Button onClick={openCreateModal}>
              <ShortcutLabel label="Nova conta" shortcutIndex={0} />
            </Button>
          </ShortcutTooltip>
        </div>
      </div>

      <AccountsFiltersPanel
        isFiltersOpen={controller.isFiltersOpen}
        searchDraft={searchDraft}
        typeFilter={typeFilter}
        hasActiveFilters={hasActiveFilters}
        onSearchDraftChange={setSearchDraft}
        onSearchEnter={handleSearchEnter}
        onTypeFilterChange={handleTypeFilterChange}
        onClearFilters={handleClearFilters}
      />

      <AccountsMobileList
        isLoading={accountsQuery.isLoading}
        isError={accountsQuery.isError}
        accounts={accounts}
        sortedAccountsCount={sortedAccounts.length}
        paginatedAccounts={paginatedAccounts}
        selectedAccountIds={selectedAccountIds}
        selectedCount={selectedCount}
        selectedTotal={selectedTotal}
        allSelectedOnPage={allSelectedOnPage}
        displayedTotal={displayedTotal}
        accountTypeLabels={accountTypeLabels}
        onOpenAccount={openAccountById}
        onToggleSelectAllOnPage={toggleSelectAllOnPage}
        onSetAccountSelected={setAccountSelected}
        onOpenCreateModal={openCreateModal}
      />

      <AccountsDesktopTable
        isLoading={accountsQuery.isLoading}
        isError={accountsQuery.isError}
        isRefreshingAccounts={isRefreshingAccounts}
        accounts={accounts}
        sortedAccountsCount={sortedAccounts.length}
        paginatedAccounts={paginatedAccounts}
        selectedAccountIds={selectedAccountIds}
        selectedCount={selectedCount}
        selectedTotal={selectedTotal}
        totalFilteredBalance={totalFilteredBalance}
        allSelectedOnPage={allSelectedOnPage}
        selectAllRef={selectAllRef}
        sortKey={sortKey}
        sortDirection={sortDirection}
        accountTypeLabels={accountTypeLabels}
        onSort={handleSort}
        onOpenAccount={openAccountById}
        onToggleSelectAccount={toggleSelectAccount}
        onSetAccountSelected={setAccountSelected}
        onToggleSelectAllOnPage={toggleSelectAllOnPage}
        onOpenCreateModal={openCreateModal}
      />

      <AccountsPagination
        sortedAccountsCount={sortedAccounts.length}
        pageSize={pageSize}
        safePage={safePage}
        totalPages={totalPages}
        onChangePageSize={handlePageSizeChange}
        onFirstPage={goToFirstPage}
        onPreviousPage={goToPreviousPage}
        onNextPage={goToNextPage}
        onLastPage={goToLastPage}
      />

      <AccountCreateModal
        isOpen={controller.isCreateOpen}
        nameField={createNameField}
        registerTypeField={createTypeField}
        registerConfirmField={createConfirmField}
        errors={errors}
        confirmValue={confirmValue}
        isSubmitting={isSubmitting}
        isMutationPending={createAccountMutation.isPending}
        createNameRef={controller.createNameRef}
        onClose={controller.closeCreateModal}
        onSubmit={submitCreateAccount}
      />

      <AccountDetailsModal
        account={selectedAccount}
        isEditOpen={controller.isEditOpen}
        detailModalRef={controller.detailModalRef}
        accountTypeLabels={accountTypeLabels}
        dateFormatter={dateFormatter}
        isTogglingDashboardVisibility={isTogglingDashboardVisibility}
        dashboardVisibilityError={dashboardVisibilityError}
        deleteError={deleteError}
        onClose={closeAccountDetails}
        onToggleDashboardVisibility={() => void handleToggleDashboardVisibility()}
        onOpenDeleteConfirm={openAccountDeleteConfirm}
        onOpenEdit={openAccountEdit}
      />

      <AccountDeleteConfirmModal
        isOpen={controller.isDeleteConfirmOpen}
        accountName={selectedAccount?.name ?? null}
        isPending={deleteAccountMutation.isPending}
        deleteBlockedReason={deleteBlockedReason}
        deleteError={deleteError}
        deleteModalRef={controller.deleteModalRef}
        onClose={controller.closeDeleteConfirmModal}
        onConfirm={() => void submitDeleteAccount()}
      />

      <AccountEditModal
        isOpen={controller.isEditOpen && !!selectedAccount}
        isPrimary={selectedAccount?.isPrimary ?? false}
        nameField={editNameField}
        registerTypeField={editTypeField}
        registerConfirmField={editConfirmField}
        errors={editErrors}
        confirmValue={confirmEditValue}
        isSubmitting={isEditSubmitting}
        isMutationPending={updateAccountMutation.isPending}
        isSettingPrimary={isSettingPrimary}
        editNameRef={controller.editNameRef}
        onClose={closeEditModal}
        onSubmit={submitEditAccount}
        onOpenPrimaryConfirm={openPrimaryConfirm}
      />

      <AccountPrimaryConfirmModal
        isOpen={isPrimaryConfirmOpen}
        accountName={selectedAccount?.name ?? null}
        isSettingPrimary={isSettingPrimary}
        primaryError={primaryError}
        onClose={closePrimaryConfirm}
        onConfirm={() => void handleSetPrimaryAccount()}
      />
    </div>
  )
}
