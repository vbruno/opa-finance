import { createRouter } from '@tanstack/react-router'

import { routeTree } from '../routeTree.gen'

export const router = createRouter({
  routeTree,
})

declare module '@tanstack/react-router' {
  // Required by TanStack Router module augmentation.
  interface Register {
    router: typeof router
  }
}
