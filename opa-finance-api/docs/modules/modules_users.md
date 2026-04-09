# Módulo: Users

## Responsabilidades

- Listar o usuário autenticado
- Buscar dados do usuário por `id` (restrito ao próprio usuário)
- Atualizar perfil (`name`, `email`, `timezone`)
- Excluir conta do usuário autenticado
- Expor catálogo de timezones IANA válidos (`pg_timezone_names`)

## Regras

- Todas as rotas exigem autenticação
- Usuário só acessa/modifica/exclui o próprio registro
- `timezone` deve ser IANA válida (ex.: `Australia/Adelaide`)
- Catálogo de timezones vem do backend para evitar divergência por ambiente

## Endpoints

- `GET /users`
- `GET /users/timezones`
- `GET /users/:id`
- `PUT /users/:id`
- `DELETE /users/:id`
