import { getToken, logout, setAccessToken } from '@/features/auth'
import { router } from '@/router/router'

import { api } from './api'

// Interceptor de requisição: adiciona token automaticamente
api.interceptors.request.use(
  (config) => {
    const token = getToken()

    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`
    }

    // Permite que cookies sejam enviados (para refresh token)
    config.withCredentials = true

    return config
  },
  (error) => {
    return Promise.reject(error)
  },
)

// Interceptor de resposta: trata erros e refresh token
type QueueItem = {
  resolve: (value?: unknown) => void
  reject: (reason?: unknown) => void
}

let isRefreshing = false
let failedQueue: Array<QueueItem> = []
let isBackendUnavailable = false

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })

  failedQueue = []
}

api.interceptors.response.use(
  (response) => {
    if (isBackendUnavailable) {
      isBackendUnavailable = false
    }
    return response
  },
  async (error) => {
    const originalRequest = error.config
    const originalUrl = String(originalRequest?.url || '')
    const isAuthEndpoint =
      originalUrl.includes('/auth/login') ||
      originalUrl.includes('/auth/refresh')

    if (!error.response) {
      if (!isBackendUnavailable) {
        isBackendUnavailable = true
        logout()
        if (router.state.location.pathname !== '/unavailable') {
          router.navigate({ to: '/unavailable' })
        }
      }
      return Promise.reject(error)
    }

    // Se for 401 e não for uma tentativa de refresh
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isAuthEndpoint
    ) {
      if (isRefreshing) {
        // Se já está tentando refresh, adiciona à fila
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((queuedToken) => {
            if (typeof queuedToken !== 'string' || queuedToken.length === 0) {
              throw new Error('Missing access token in refresh queue')
            }
            originalRequest.headers.Authorization = `Bearer ${queuedToken}`
            return api(originalRequest)
          })
          .catch((err) => {
            return Promise.reject(err)
          })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        // Tenta renovar o token
        const response = await api.post(
          '/auth/refresh',
          {},
          { withCredentials: true },
        )
        const { accessToken } = response.data

        if (typeof accessToken !== 'string' || accessToken.length === 0) {
          throw new Error('Missing access token in refresh response')
        }

        // Atualiza somente token; usuário permanece o mesmo.
        setAccessToken(accessToken)

        processQueue(null, accessToken)

        // Retry da requisição original
        originalRequest.headers.Authorization = `Bearer ${accessToken}`
        return api(originalRequest)
      } catch (refreshError) {
        // Se refresh falhar, faz logout e redireciona
        processQueue(refreshError, null)
        logout()
        router.navigate({ to: '/login' })
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  },
)
