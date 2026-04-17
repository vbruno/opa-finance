import { DEFAULT_TIMEZONE } from '@/lib/timezones'

export const PROFILE_DEFAULT_TIMEZONE = DEFAULT_TIMEZONE

export const PROFILE_SUCCESS_MESSAGES = {
  profileUpdated: 'Perfil atualizado com sucesso.',
  passwordUpdated: 'Senha alterada com sucesso.',
} as const

export const PROFILE_ERROR_MESSAGES = {
  missingUser: 'Usuário não encontrado',
  profileUpdateDefault: 'Erro ao atualizar perfil. Tente novamente.',
  passwordUpdateDefault: 'Erro ao alterar senha. Tente novamente.',
  invalidCredentials: 'Senha atual incorreta.',
} as const
