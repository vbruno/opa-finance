import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'

export async function pingApi() {
  await api.get('/')
}

export type ApiVersion = {
  version: string
  commit: string
  buildTime: string
}

const apiVersionKey = ['api-version']

export function useApiVersion(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: apiVersionKey,
    queryFn: async () => {
      const response = await api.get<ApiVersion>('/version')
      return response.data
    },
    enabled: options?.enabled,
    retry: 1,
    staleTime: 5 * 60 * 1000,
  })
}
