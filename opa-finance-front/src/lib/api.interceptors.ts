import { api } from './api'
import { getUser } from '@/auth/auth.store'
import { redirect } from '@tanstack/react-router'

api.interceptors.request.use((config) => {
  const user = getUser()

  if (user) {
    config.headers.Authorization = `Bearer fake-token`
  }

  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      redirect({ to: '/login' })
    }

    return Promise.reject(error)
  },
)
