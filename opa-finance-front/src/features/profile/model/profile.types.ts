import type { User } from '@/features/auth'

export type ProfileUser = User | null

export type ProfileFormValues = {
  name: string
  timezone: string
}

export type ProfileTimezoneCatalogInput = {
  apiOptions?: string[]
  localOptions: string[]
}
