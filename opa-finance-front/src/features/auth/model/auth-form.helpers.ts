import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'

import { getApiErrorMessage } from '@/lib/apiError'

type SetApiRootFormErrorInput<TFormValues extends FieldValues> = {
  error: unknown
  setError: UseFormSetError<TFormValues>
  defaultMessage: string
  invalidCredentialsMessage?: string
  fieldPath?: Path<TFormValues>
}

export function setApiRootFormError<TFormValues extends FieldValues>({
  error,
  setError,
  defaultMessage,
  invalidCredentialsMessage,
  fieldPath,
}: SetApiRootFormErrorInput<TFormValues>) {
  const message = getApiErrorMessage(error, {
    defaultMessage,
    invalidCredentialsMessage,
  })

  setError(fieldPath ?? ('root' as Path<TFormValues>), { message })
}
