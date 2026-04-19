type AccountDeleteErrorFeedbackInput = {
  status: number | undefined
  message: string
  isRecurrenceConflict: boolean
}

export function resolveAccountDeleteErrorFeedback({
  status,
  message,
  isRecurrenceConflict,
}: AccountDeleteErrorFeedbackInput) {
  if (status === 409) {
    return {
      deleteError: null,
      deleteBlockedReason: isRecurrenceConflict
        ? `${message} Finalize ou remapeie as recorrências antes de excluir a conta.`
        : message,
    }
  }

  return {
    deleteError: message,
    deleteBlockedReason: null,
  }
}
