import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, type RenderOptions } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'

import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { routeTree } from '@/routeTree.gen'

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  const queryClient = createTestQueryClient()
  function Providers({ children }: { children: ReactNode }) {
    return (
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </ThemeProvider>
    )
  }

  return render(ui, {
    wrapper: Providers,
    ...options,
  })
}

type RenderRouteWithProvidersInput = {
  initialEntries?: string[]
}

export function renderRouteWithProviders({
  initialEntries = ['/'],
}: RenderRouteWithProvidersInput = {}) {
  const queryClient = createTestQueryClient()
  const history = createMemoryHistory({ initialEntries })
  const router = createRouter({
    routeTree,
    history,
  })

  return {
    router,
    queryClient,
    ...render(
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </ThemeProvider>,
    ),
  }
}

export * from '@testing-library/react'
