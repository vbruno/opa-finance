import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'

import { getApiErrorMessage, type ApiErrorMessageOptions } from './apiError'

type SetFormApiErrorInput<TFormValues extends FieldValues> = {
  error: unknown
  setError: UseFormSetError<TFormValues>
  fieldPath?: Path<TFormValues>
  options?: ApiErrorMessageOptions
}

export function setFormApiError<TFormValues extends FieldValues>({
  error,
  setError,
  fieldPath,
  options,
}: SetFormApiErrorInput<TFormValues>) {
  setError(fieldPath ?? ('root' as Path<TFormValues>), {
    message: getApiErrorMessage(error, options),
  })
}

type SetFormApiRootErrorInput<TFormValues extends FieldValues> = {
  error: unknown
  setError: UseFormSetError<TFormValues>
  options?: ApiErrorMessageOptions
}

export function setFormApiRootError<TFormValues extends FieldValues>({
  error,
  setError,
  options,
}: SetFormApiRootErrorInput<TFormValues>) {
  setFormApiError({
    error,
    setError,
    fieldPath: 'root' as Path<TFormValues>,
    options,
  })
}
