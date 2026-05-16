type ApiError = {
  response?: {
    status?: number
    data?: {
      detail?: string
      title?: string
    }
  }
}

export type ApiErrorMessageOptions = {
  defaultMessage?: string
  invalidCredentialsMessage?: string
}

export function getApiErrorStatus(error: unknown) {
  if (!error || typeof error !== 'object' || !('response' in error)) {
    return undefined
  }

  const apiError = error as ApiError
  return apiError.response?.status
}

export function getApiErrorMessage(
  error: unknown,
  options: ApiErrorMessageOptions = {},
) {
  const {
    defaultMessage = 'Erro ao processar a solicitação. Tente novamente.',
    invalidCredentialsMessage = 'Credenciais inválidas',
  } = options

  if (!error || typeof error !== 'object' || !('response' in error)) {
    return defaultMessage
  }

  const apiError = error as ApiError
  const status = getApiErrorStatus(error)
  const detail =
    apiError.response?.data?.detail || apiError.response?.data?.title

  if (status === 401) {
    return invalidCredentialsMessage
  }

  if (status === 429) {
    return detail || 'Muitas tentativas. Tente novamente em alguns minutos.'
  }

  if (status === 400) {
    return detail || defaultMessage
  }

  return detail || defaultMessage
}
