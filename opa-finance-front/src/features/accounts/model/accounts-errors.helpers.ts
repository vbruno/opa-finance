export function getApiErrorStatus(error: unknown) {
  if (!error || typeof error !== 'object' || !('response' in error)) {
    return undefined
  }

  const response = (error as { response?: { status?: number } }).response
  return response?.status
}
