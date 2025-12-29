import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/app/accounts/$id')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/app/accounts',
      search: {
        id: params.id,
      },
    })
  },
  component: () => null,
})
