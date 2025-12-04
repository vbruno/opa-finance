
# Módulo: Auth

## Responsabilidades
- Registro
- Login
- Logout
- Refresh Token
- Proteção de rotas

## Regras de Negócio
- Senha criptografada
- Email único
- Refresh armazenado em cookie httpOnly

## Endpoints
POST /auth/register  
POST /auth/login  
POST /auth/refresh  
POST /auth/logout  
GET /auth/me  
