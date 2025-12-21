import { getToken, logout } from '@/auth/auth.store'
import { router } from '@/router/router'

import { api } from './api'

// Interceptor de requisição: adiciona token automaticamente
api.interceptors.request.use(
  (config) => {
    const token = getToken()

    if (token) {
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
  // eslint-disable-next-line no-unused-vars
  resolve: (value?: unknown) => void
  // eslint-disable-next-line no-unused-vars
  reject: (reason?: unknown) => void
}

let isRefreshing = false
let failedQueue: Array<QueueItem> = []

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
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // Se for 401 e não for uma tentativa de refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Se já está tentando refresh, adiciona à fila
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
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

        // Atualiza o token no store (sem atualizar user, pois vem do cookie)
        const { setAuth, getUser } = await import('@/auth/auth.store')
        const user = getUser()
        if (user && accessToken) {
          setAuth(accessToken, user)
        }

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
