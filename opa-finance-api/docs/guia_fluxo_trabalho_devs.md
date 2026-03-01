# Fluxo de Trabalho para Devs

Este documento descreve o fluxo recomendado para quem vai contribuir no backend do projeto, com foco em ambiente, banco, migrations, testes e atualizacao do banco de desenvolvimento.

## Ambientes

O projeto trabalha com tres contextos principais de banco:

- `prod`: banco real da aplicacao
- `dev`: banco de desenvolvimento remoto usado no dia a dia
- `test`: banco isolado para testes automatizados

Regra principal:

- nunca aponte o ambiente local para o banco de `prod`

## Configuracao local

No backend, o `.env` local deve manter:

- `DATABASE_URL` apontando para `api_finance_dev`
- `DATABASE_URL_TEST` apontando para `api_finance_test`

Exemplo:

```env
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/api_finance_dev
DATABASE_URL_TEST=postgresql://USER:PASSWORD@localhost:5432/api_finance_test

SSH_HOST=user@server
SSH_KEY=~/.ssh/id_ed25519
SSH_CONTAINER_NAME=postgres_infra
SSH_POSTGRES_USER=api_finance_api
SSH_POSTGRES_DB=api_finance
SSH_POSTGRES_DEV_DB=api_finance_dev
SSH_POSTGRES_TEST_DB=api_finance_test
```

## Fluxo diario de desenvolvimento

Fluxo comum para trabalhar no backend:

```sh
npm install
npm run db:migrate
npm run dev
```

Quando alterar schema:

```sh
npm run db:generate
npm run db:migrate
```

Quando precisar rodar testes:

```sh
./scripts/db-tunnel.sh
npm run db:test:migrate
npm run test
```

## Quando usar o banco de dev

Use `dev` para:

- desenvolvimento diario
- validacao manual de novas funcionalidades
- testes manuais integrados
- reproducao de cenarios mais proximos do ambiente real

Esse banco pode ser atualizado com uma copia de `prod`, mas deve continuar separado de producao.

## Atualizando o banco de dev com dados de producao

Quando precisar atualizar `dev` com uma copia de `prod`:

```sh
npm run db:sync:dev
```

O script:

1. conecta no servidor remoto via SSH
2. valida container e bancos envolvidos
3. pergunta se deve gerar backup preventivo do `dev`
4. sobrescreve `dev` com um dump de `prod`
5. pergunta se deve aplicar sanitizacao

Importante:

- o sync sobrescreve o estado atual do banco de `dev`
- ele nao faz merge nem incremento
- qualquer dado existente em `dev` pode ser perdido

## Sanitizacao

O script pode aplicar sanitizacao apos o restore usando:

```text
scripts/db-sanitize-dev.sql
```

Use sanitizacao quando:

- quiser reduzir exposicao de dados reais
- estiver preparando um ambiente mais seguro para desenvolvimento

Pode fazer sentido nao sanitizar quando:

- for necessario reproduzir um comportamento com dados mais proximos do real
- voce estiver fazendo testes manuais especificos

Se surgirem novas colunas sensiveis, atualize esse arquivo.

## Backup preventivo

O backup preventivo e opcional no `db:sync:dev`.

Use backup quando:

- o estado atual do `dev` ainda importa
- voce quer um ponto de retorno antes de sobrescrever o banco

Pode pular backup quando:

- estiver apenas testando o fluxo
- o estado atual do `dev` nao tiver valor

Os backups ficam em:

```text
opa-finance-api/backups/
```

## Banco de testes

O ambiente de testes deve continuar separado do banco de `dev`.

Fluxo comum:

```sh
./scripts/db-tunnel.sh
npm run db:test:migrate
npm run test
```

Nao use o banco de `dev` para testes automatizados.

Se precisar resetar um ambiente remoto com mais seguranca, prefira os atalhos explicitos:

```sh
npm run db:reset:dev
npm run db:reset:test
```

Deixe `npm run db:reset` apenas para quando quiser escolher o alvo manualmente.

## Validacao apos o sync

Depois do sync, valide no banco `api_finance_dev`:

```sql
SELECT current_database(), current_user;
```

```sql
SELECT 'users' AS tabela, COUNT(*) AS total FROM users
UNION ALL
SELECT 'accounts', COUNT(*) FROM accounts
UNION ALL
SELECT 'categories', COUNT(*) FROM categories
UNION ALL
SELECT 'subcategories', COUNT(*) FROM subcategories
UNION ALL
SELECT 'transactions', COUNT(*) FROM transactions;
```

Se usar pgAdmin, pode ser necessario fazer `Refresh` antes de abrir `View/Edit Data`, porque o restore recria objetos e a interface pode manter uma visao antiga.

## Resumo pratico

Para contribuir no projeto com seguranca:

1. trabalhe sempre com `DATABASE_URL` apontando para `dev`
2. use `DATABASE_URL_TEST` apenas para testes automatizados
3. rode migrations antes de validar mudancas locais
4. use `db:sync:dev` quando precisar aproximar `dev` de `prod`
5. trate o sync como sobrescrita total do banco de desenvolvimento
