import type { Category } from '@/features/categories/categories.api'

export function normalizeSearch(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function isRecurrenceConflictMessage(message: string | null | undefined) {
  if (!message) {
    return false
  }
  return normalizeSearch(message).includes('recorrencia ativa')
}

export function normalizeOptionalDescription(value?: string | null) {
  if (typeof value !== 'string') {
    return null
  }
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

export function arraysEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false
    }
  }
  return true
}

export function sortUserCategories(categories: Category[]) {
  const typeRank: Record<string, number> = {
    income: 0,
    expense: 1,
  }

  return [...categories].sort((a, b) => {
    const typeDiff = (typeRank[a.type] ?? 99) - (typeRank[b.type] ?? 99)
    if (typeDiff !== 0) return typeDiff
    return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
  })
}
