import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { pingApi } from '@/features/system/health.api'

export const Route = createFileRoute('/unavailable')({
  component: UnavailableScreen,
})

function UnavailableScreen() {
  const navigate = Route.useNavigate()
  const [status, setStatus] = useState<
    'idle' | 'checking' | 'online' | 'offline'
  >('idle')
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(
    null,
  )

  const handleCheckStatus = async () => {
    if (status === 'checking') {
      return
    }
    setStatus('checking')
    try {
      await pingApi()
      setStatus('online')
    } catch {
      setStatus('offline')
    }
  }

  useEffect(() => {
    if (status !== 'online') {
      setRedirectCountdown(null)
      return
    }

    setRedirectCountdown(10)
    const intervalId = window.setInterval(() => {
      setRedirectCountdown((prev) => {
        if (prev === null) {
          return 10
        }
        if (prev <= 1) {
          window.clearInterval(intervalId)
          navigate({ to: '/login' })
          return null
        }
        return prev - 1
      })
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [navigate, status])

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-lg space-y-4 rounded-lg border bg-card p-6 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Sistema indisponível</h1>
          <p className="text-sm text-muted-foreground">
            Não foi possível se conectar ao servidor. Você foi desconectado.
            Tente fazer login novamente ou volte mais tarde.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Status do servidor:</span>
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-semibold ${status === 'checking'
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'
              : status === 'online'
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : status === 'offline'
                  ? 'border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                  : 'border-muted-foreground/30 bg-muted/40 text-muted-foreground'
              }`}
          >
            {status === 'checking'
              ? 'Verificando...'
              : status === 'online'
                ? 'Online'
                : status === 'offline'
                  ? 'Offline'
                  : 'Desconhecido'}
          </span>
        </div>
        <div className="flex flex-wrap gap-4 items-center">
          <Button onClick={() => navigate({ to: '/login' })}>
            Ir para login
          </Button>
          {status === 'online' && redirectCountdown !== null ? (
            <p className="text-sm text-muted-foreground">
              Você será redirecionado em{' '}
              <span className="font-semibold text-foreground">
                {redirectCountdown}s
              </span>
              .
            </p>
          ) : (
            <Button
              variant="outline"
              onClick={handleCheckStatus}
              disabled={status === 'checking'}
            >
              Verificar status
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
