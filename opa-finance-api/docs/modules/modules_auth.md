# Módulo: Auth

## Responsabilidades

- Registro
- Login
- Logout
- Refresh Token
- Proteção de rotas
- Alteração de senha (autenticado)
- Recuperação de senha por email

## Regras de Negócio

- Senha criptografada (bcrypt, 10 salt rounds)
- Email único
- Refresh armazenado em cookie httpOnly
- Access token JWT de curta duração (15 min)
- Tokens de reset são opacos (não JWT): 32 bytes aleatórios; apenas `sha256(token)` é persistido em `password_reset_tokens`
- Token de reset expira em 15 min, é **de uso único** (campo `used_at`) e invalida demais tokens ativos do mesmo usuário ao ser consumido
- `POST /auth/forgot-password` retorna mensagem genérica mesmo quando o email não existe (não revelar enumeração)
- Rate limit de 5 requisições por hora por chave `IP|email` em `POST /auth/forgot-password`
- Cleanup diário (dentro do recurrence-daily-job) remove tokens com `expires_at < now() - interval '7 days'`

## Emails transacionais

- Provider: Resend (`RESEND_API_KEY`, `EMAIL_FROM`, `APP_BASE_URL`)
- Templates HTML+texto em pt-BR (`src/core/services/email.service.ts`)
- Falha de envio é logada sem interromper o fluxo (resposta ao usuário continua genérica)
- Sem `RESEND_API_KEY` configurada, o service loga warning e não envia (útil em dev/teste)

Emails enviados:
- **Reset de senha** — disparado por `POST /auth/forgot-password` quando o usuário existe. Contém link `${APP_BASE_URL}/reset-password?token=<token>`.
- **Senha alterada** — disparado por `POST /auth/reset-password` após sucesso. Inclui data/hora no timezone do usuário e o IP requisitante (se disponível).

## Endpoints

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`
- `POST /auth/check-password-strength`
- `POST /auth/change-password`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
