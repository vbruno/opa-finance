import type { KeyboardEventHandler, MutableRefObject, RefObject } from 'react'

export const CATEGORY_TREE_NONE = '__none__'
export const CATEGORY_TREE_CREATE = '__create_category__'
export const CATEGORY_TREE_CREATE_SUB = '__create_subcategory__'

type UseCategoryTreeInteractionParams = {
  categoryId: string
  subcategoryId: string
  contentRef: RefObject<HTMLDivElement | null>
  searchInputRef: RefObject<HTMLInputElement | null>
  setSearch: (value: string) => void
  setIsOpen: (open: boolean) => void
  setIsCreateCategoryOpen: (open: boolean) => void
  setIsCreateSubcategoryOpen: (open: boolean) => void
  setValue: (name: string, value: string, options?: { shouldDirty?: boolean; shouldTouch?: boolean }) => void
  lastCategoryId: MutableRefObject<string | null>
}

export function useCategoryTreeInteraction({
  categoryId,
  subcategoryId,
  contentRef,
  searchInputRef,
  setSearch,
  setIsOpen,
  setIsCreateCategoryOpen,
  setIsCreateSubcategoryOpen,
  setValue,
  lastCategoryId,
}: UseCategoryTreeInteractionParams) {
  const findVisibleSiblingOption = (element: HTMLElement, direction: 'prev' | 'next') => {
    let sibling: Element | null =
      direction === 'prev' ? element.previousElementSibling : element.nextElementSibling

    while (sibling) {
      if (
        sibling instanceof HTMLElement &&
        sibling.getAttribute('role') === 'option' &&
        sibling.offsetParent !== null &&
        sibling.getAttribute('aria-disabled') !== 'true' &&
        !sibling.hasAttribute('data-disabled')
      ) {
        return sibling
      }
      sibling =
        direction === 'prev' ? sibling.previousElementSibling : sibling.nextElementSibling
    }

    return null
  }

  const focusCategoryTreeOption = (direction: 'up' | 'down') => {
    const content = contentRef.current
    if (!content) return

    const options = Array.from(
      content.querySelectorAll<HTMLElement>('[role="option"]'),
    ).filter(
      (option) =>
        option.offsetParent !== null &&
        option.getAttribute('aria-disabled') !== 'true' &&
        !option.hasAttribute('data-disabled'),
    )

    if (options.length === 0) return

    const selectedIndex = options.findIndex(
      (option) =>
        option.getAttribute('aria-selected') === 'true' ||
        option.getAttribute('data-state') === 'checked',
    )

    const nextIndex =
      selectedIndex === -1
        ? direction === 'down'
          ? 0
          : options.length - 1
        : direction === 'down'
          ? Math.min(selectedIndex + 1, options.length - 1)
          : Math.max(selectedIndex - 1, 0)

    options[nextIndex]?.focus({ preventScroll: true })
  }

  const getCategoryTreeValue = () => {
    if (!categoryId) return CATEGORY_TREE_NONE
    if (subcategoryId) return `subcategory:${categoryId}:${subcategoryId}`
    return `category:${categoryId}`
  }

  const handleCategoryTreeOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) {
      setSearch('')
      return
    }
    window.requestAnimationFrame(() => {
      searchInputRef.current?.focus()
    })
  }

  const handleCategoryTreeSelectValueChange = (
    value: string,
    onChange: (value: string) => void,
  ) => {
    if (value === CATEGORY_TREE_CREATE) {
      setSearch('')
      setIsCreateCategoryOpen(true)
      return
    }
    if (value === CATEGORY_TREE_CREATE_SUB) {
      setSearch('')
      setIsCreateSubcategoryOpen(true)
      return
    }
    if (value === CATEGORY_TREE_NONE) {
      setSearch('')
      onChange('')
      setValue('subcategoryId', '', { shouldDirty: true, shouldTouch: true })
      return
    }

    setSearch('')
    if (value.startsWith('subcategory:')) {
      const [, categoryId, subcategoryId] = value.split(':')
      lastCategoryId.current = categoryId ?? null
      onChange(categoryId ?? '')
      setValue('subcategoryId', subcategoryId ?? '', { shouldDirty: true, shouldTouch: true })
      return
    }

    const [, categoryId] = value.split(':')
    onChange(categoryId ?? '')
    setValue('subcategoryId', '', { shouldDirty: true, shouldTouch: true })
  }

  const handleCategoryTreeSearchKeyDown: KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (event.key === 'Tab') {
      event.preventDefault()
      event.stopPropagation()
      focusCategoryTreeOption(event.shiftKey ? 'up' : 'down')
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      event.stopPropagation()
      focusCategoryTreeOption('down')
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      event.stopPropagation()
      focusCategoryTreeOption('up')
      return
    }
    if (event.key === 'Escape') return
    const isTypingKey =
      (event.key.length === 1 || event.key === 'Dead') &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    if (isTypingKey || event.key === 'Backspace' || event.key === 'Delete') {
      event.stopPropagation()
      event.nativeEvent.stopImmediatePropagation?.()
      return
    }
    event.stopPropagation()
  }

  const handleCategoryTreeItemKeyDown: KeyboardEventHandler<HTMLDivElement> = (event) => {
    if (event.key === 'Backspace') {
      event.preventDefault()
      event.stopPropagation()
      window.requestAnimationFrame(() => {
        searchInputRef.current?.focus()
      })
      return
    }
    const current = event.currentTarget as HTMLElement
    if (event.key === 'ArrowDown') {
      const nextOption = findVisibleSiblingOption(current, 'next')
      if (nextOption) return
      event.preventDefault()
      event.stopPropagation()
      searchInputRef.current?.focus()
      return
    }
    if (event.key !== 'ArrowUp') return
    const previousOption = findVisibleSiblingOption(current, 'prev')
    if (previousOption) return
    event.preventDefault()
    event.stopPropagation()
    searchInputRef.current?.focus()
  }

  return {
    getCategoryTreeValue,
    handleCategoryTreeOpenChange,
    handleCategoryTreeSelectValueChange,
    handleCategoryTreeSearchKeyDown,
    handleCategoryTreeItemKeyDown,
  }
}
