import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'

import { pingApi } from '@/features/system/health.api'

export const Route = createFileRoute('/app/')({
  component: Dashboard,
})

function Dashboard() {
  useEffect(() => {
    pingApi()
      .finally(() => {
        console.log('API conectada')
      })
      .catch(() => {
        console.log('API não conectada (ok por enquanto)')
      })
  }, [])

  return <h1 className="text-2xl font-bold">Dashboard</h1>
}
