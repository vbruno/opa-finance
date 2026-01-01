import { api } from '@/lib/api'

export async function pingApi() {
  await api.get('/')
}
