import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'

import { setFormApiError } from '@/lib/form-api-error'

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
  setFormApiError({
    error,
    setError,
    fieldPath,
    options: {
      defaultMessage,
      invalidCredentialsMessage,
    },
  })
}

type SubmitWithApiRootErrorInput<
  TFormValues extends FieldValues,
  TPayload,
  TResult,
> = {
  payload: TPayload
  execute: (payload: TPayload) => Promise<TResult>
  setError: UseFormSetError<TFormValues>
  defaultMessage: string
  invalidCredentialsMessage?: string
  clearRootError?: () => void
  onSuccess?: (result: TResult) => void | Promise<void>
}

export async function submitWithApiRootError<
  TFormValues extends FieldValues,
  TPayload,
  TResult,
>({
  payload,
  execute,
  setError,
  defaultMessage,
  invalidCredentialsMessage,
  clearRootError,
  onSuccess,
}: SubmitWithApiRootErrorInput<TFormValues, TPayload, TResult>) {
  clearRootError?.()
  try {
    const result = await execute(payload)
    if (onSuccess) {
      await onSuccess(result)
    }
  } catch (error: unknown) {
    setApiRootFormError({
      error,
      setError,
      defaultMessage,
      invalidCredentialsMessage,
    })
  }
}

export function isAuthFormPending(
  isSubmitting: boolean,
  isMutationPending: boolean,
) {
  return isSubmitting || isMutationPending
}
