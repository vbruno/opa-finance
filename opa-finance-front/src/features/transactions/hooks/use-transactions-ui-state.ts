import {
  useRef,
  useState,
  type ClipboardEventHandler,
  type KeyboardEventHandler,
  type MouseEventHandler,
} from 'react'

import type { Subcategory } from '@/features/categories'
import { useMediaQuery } from '@/hooks/useMediaQuery'

import type { Transaction } from '../transactions.api'

export function useTransactionsUiState() {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isTransferOpen, setIsTransferOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isCreateCategoryOpen, setIsCreateCategoryOpen] = useState(false)
  const [isCreateSubcategoryOpen, setIsCreateSubcategoryOpen] = useState(false)
  const [lastCreatedSubcategory, setLastCreatedSubcategory] =
    useState<Subcategory | null>(null)
  const pendingCategorySelection = useRef<string | null>(null)
  const pendingSubcategorySelection = useRef<{
    categoryId: string
    subcategoryId: string
  } | null>(null)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [copiedValue, setCopiedValue] = useState<'average' | 'total' | null>(
    null,
  )
  const [detailCopiedField, setDetailCopiedField] = useState<
    'description' | 'amount' | null
  >(null)
  const [isDescriptionSuggestionsOpen, setIsDescriptionSuggestionsOpen] =
    useState(false)
  const [isDescriptionFocused, setIsDescriptionFocused] = useState(false)
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0)
  const [isCreateCategoryTreeOpen, setIsCreateCategoryTreeOpen] =
    useState(false)
  const [isCreateAccountSelectOpen, setIsCreateAccountSelectOpen] =
    useState(false)
  const [isEditAccountSelectOpen, setIsEditAccountSelectOpen] = useState(false)
  const [isTransferFromAccountSelectOpen, setIsTransferFromAccountSelectOpen] =
    useState(false)
  const [isTransferToAccountSelectOpen, setIsTransferToAccountSelectOpen] =
    useState(false)
  const [createCategoryTreeSearch, setCreateCategoryTreeSearch] = useState('')
  const [isEditCategoryTreeOpen, setIsEditCategoryTreeOpen] = useState(false)
  const [editCategoryTreeSearch, setEditCategoryTreeSearch] = useState('')
  const [createCategoryModalTarget, setCreateCategoryModalTarget] = useState<
    'create' | 'edit'
  >('create')
  const [createSubcategoryModalTarget, setCreateSubcategoryModalTarget] =
    useState<'create' | 'edit'>('create')
  const CREATE_CATEGORY_TREE_NONE = '__none__'
  const CREATE_CATEGORY_TREE_CREATE_CATEGORY = '__create_category__'
  const CREATE_CATEGORY_TREE_CREATE_SUBCATEGORY = '__create_subcategory__'
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false)
  const createAmountRef = useRef<HTMLInputElement | null>(null)
  const transferAmountRef = useRef<HTMLInputElement | null>(null)
  const editAmountRef = useRef<HTMLInputElement | null>(null)
  const descriptionInputRef = useRef<HTMLInputElement | null>(null)
  const dateInputRef = useRef<HTMLInputElement | null>(null)
  const createCategorySelectRef = useRef<HTMLButtonElement | null>(null)
  const createCategoryTreeSearchInputRef = useRef<HTMLInputElement | null>(null)
  const createCategoryTreeContentRef = useRef<HTMLDivElement | null>(null)
  const editCategoryTreeSearchInputRef = useRef<HTMLInputElement | null>(null)
  const editCategoryTreeContentRef = useRef<HTMLDivElement | null>(null)
  const subcategoryNameRef = useRef<HTMLInputElement | null>(null)
  const categoryNameRef = useRef<HTMLInputElement | null>(null)
  const categoryTypeRef = useRef<HTMLSelectElement | null>(null)
  const detailModalRef = useRef<HTMLDivElement | null>(null)
  const deleteModalRef = useRef<HTMLDivElement | null>(null)
  const bulkDeleteModalRef = useRef<HTMLDivElement | null>(null)
  const selectAllRef = useRef<HTMLInputElement | null>(null)
  const copyTimeoutRef = useRef<number | null>(null)
  const detailCopyTimeoutRef = useRef<number | null>(null)
  const lastCreateCategoryId = useRef<string | null>(null)
  const lastEditCategoryId = useRef<string | null>(null)
  const isCreateFromDuplicate = useRef(false)
  const isMobile = useMediaQuery('(max-width: 639px)')
  const handleMobileDateKeyDown: KeyboardEventHandler<HTMLInputElement> = (
    event,
  ) => {
    if (isMobile) {
      event.preventDefault()
    }
  }
  const handleMobileDatePaste: ClipboardEventHandler<HTMLInputElement> = (
    event,
  ) => {
    if (isMobile) {
      event.preventDefault()
    }
  }
  const handleDateClick: MouseEventHandler<HTMLInputElement> = (event) => {
    const target = event.currentTarget
    if (typeof target.showPicker !== 'function') {
      return
    }
    if (isMobile || event.detail > 0) {
      target.showPicker()
    }
  }

  return {
    isCreateOpen,
    setIsCreateOpen,
    isTransferOpen,
    setIsTransferOpen,
    isEditOpen,
    setIsEditOpen,
    isCreateCategoryOpen,
    setIsCreateCategoryOpen,
    isCreateSubcategoryOpen,
    setIsCreateSubcategoryOpen,
    lastCreatedSubcategory,
    setLastCreatedSubcategory,
    pendingCategorySelection,
    pendingSubcategorySelection,
    isDeleteConfirmOpen,
    setIsDeleteConfirmOpen,
    isBulkDeleteOpen,
    setIsBulkDeleteOpen,
    selectedTransaction,
    setSelectedTransaction,
    deleteError,
    setDeleteError,
    bulkDeleteError,
    setBulkDeleteError,
    isBulkDeleting,
    setIsBulkDeleting,
    copiedValue,
    setCopiedValue,
    detailCopiedField,
    setDetailCopiedField,
    isDescriptionSuggestionsOpen,
    setIsDescriptionSuggestionsOpen,
    isDescriptionFocused,
    setIsDescriptionFocused,
    activeSuggestionIndex,
    setActiveSuggestionIndex,
    isCreateCategoryTreeOpen,
    setIsCreateCategoryTreeOpen,
    isCreateAccountSelectOpen,
    setIsCreateAccountSelectOpen,
    isEditAccountSelectOpen,
    setIsEditAccountSelectOpen,
    isTransferFromAccountSelectOpen,
    setIsTransferFromAccountSelectOpen,
    isTransferToAccountSelectOpen,
    setIsTransferToAccountSelectOpen,
    createCategoryTreeSearch,
    setCreateCategoryTreeSearch,
    isEditCategoryTreeOpen,
    setIsEditCategoryTreeOpen,
    editCategoryTreeSearch,
    setEditCategoryTreeSearch,
    createCategoryModalTarget,
    setCreateCategoryModalTarget,
    createSubcategoryModalTarget,
    setCreateSubcategoryModalTarget,
    CREATE_CATEGORY_TREE_NONE,
    CREATE_CATEGORY_TREE_CREATE_CATEGORY,
    CREATE_CATEGORY_TREE_CREATE_SUBCATEGORY,
    isFiltersOpen,
    setIsFiltersOpen,
    isCreateMenuOpen,
    setIsCreateMenuOpen,
    createAmountRef,
    transferAmountRef,
    editAmountRef,
    descriptionInputRef,
    dateInputRef,
    createCategorySelectRef,
    createCategoryTreeSearchInputRef,
    createCategoryTreeContentRef,
    editCategoryTreeSearchInputRef,
    editCategoryTreeContentRef,
    subcategoryNameRef,
    categoryNameRef,
    categoryTypeRef,
    detailModalRef,
    deleteModalRef,
    bulkDeleteModalRef,
    selectAllRef,
    copyTimeoutRef,
    detailCopyTimeoutRef,
    lastCreateCategoryId,
    lastEditCategoryId,
    isCreateFromDuplicate,
    isMobile,
    handleMobileDateKeyDown,
    handleMobileDatePaste,
    handleDateClick,
  }
}
