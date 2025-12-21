import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'

import { api } from '@/lib/api'

export const Route = createFileRoute('/app/')({
  component: Dashboard,
})

function Dashboard() {
  useEffect(() => {
    api.get('/')
      .finally(() => {
        console.log('API conectada')
      })
      .catch(() => {
        console.log('API não conectada (ok por enquanto)')
      })
  }, [])

  return <h1 className="text-2xl font-bold">Dashboard</h1>
}
