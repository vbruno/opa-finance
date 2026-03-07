# Contrato de Versionamento

Este projeto adota um versionamento operacional simples, automatico no `PATCH` e manual no `MAJOR.MINOR`.

## Regras

- `main` e sempre a branch de producao.
- `dev` representa o ciclo atual de desenvolvimento.
- A versao segue o formato `MAJOR.MINOR.PATCH`.
- `MAJOR` sobe manualmente quando houver mudanca grande.
- `MINOR` sobe manualmente quando comecar um novo ciclo de desenvolvimento.
- `PATCH` e incrementado automaticamente conforme os commits do ciclo atual.

## Formato por ambiente

- Desenvolvimento: `MAJOR.MINOR.PATCH-dev`
- Producao: `MAJOR.MINOR.PATCH`

Exemplo:

- Em desenvolvimento: `1.1.3-dev`
- Em producao: `1.1.3`

## Ciclo de release

1. A producao atual esta em `main`, por exemplo `1.0.12`.
2. Ao iniciar um novo ciclo, cria-se ou atualiza-se a branch `dev`.
3. Nesse momento, `MINOR` sobe manualmente e `PATCH` volta para `0`.
4. O primeiro estado do novo ciclo fica `1.1.0-dev`.
5. A cada commit no ciclo atual, o `PATCH` aumenta automaticamente:
   - `1.1.1-dev`
   - `1.1.2-dev`
   - `1.1.3-dev`
6. Quando o ciclo estiver estavel, o codigo vai para `main`.
7. Em `main`, a mesma versao perde apenas o sufixo `-dev`:
   - `1.1.3`

## Responsabilidades

Manual:

- Definir o `MAJOR`
- Decidir quando um novo ciclo deve comecar
- Criar a tag Git de release em `main`

Observacao importante:

- O inicio de um novo ciclo nao e inferido automaticamente.
- Ao abrir um novo ciclo em `dev`, e necessario decidir que a base da versao vai mudar.
- Quando isso acontecer pelo fluxo oficial, o script `./scripts/version-cycle.sh` aplica automaticamente o bump de `MINOR` e o reset do `PATCH` para `0`.
- Exemplo: depois de publicar `1.1.3`, o proximo ciclo deve ser ajustado manualmente para `1.2.0-dev`.

Automatico:

- Incrementar o `PATCH` durante o ciclo atual
- Adicionar `-dev` fora de producao
- Remover `-dev` em producao

## Tag Git de release

Toda publicacao em producao deve receber uma tag no commit da `main`.

Formato recomendado:

- `vMAJOR.MINOR.PATCH`

Exemplo:

```bash
git checkout main
git pull
git tag -a v1.1.3 -m "Release v1.1.3"
git push origin main
git push origin v1.1.3
```

Essa tag marca exatamente qual commit virou release de producao.

## Resumo operacional

- Novo ciclo de desenvolvimento: sobe `MINOR` e zera `PATCH`
- Durante desenvolvimento: `PATCH` sobe sozinho por commit
- Publicacao em `main`: remove `-dev`
- Release publicada: cria tag Git na `main`

## Script interativo

Use o menu interativo:

```bash
./scripts/version-cycle.sh
```

Opcoes disponiveis:

- iniciar novo ciclo em `dev`
- promover `dev` para `main`
- mostrar a versao calculada atual

Internamente, esse fluxo reaproveita os scripts operacionais abaixo:

- `scripts/start-dev-cycle.sh`
- `scripts/promote-dev-to-main.sh`

### Iniciar novo ciclo em `dev`

Esse fluxo:

- troca para `main`
- cria ou atualiza a branch `dev`
- sobe o `MINOR` automaticamente no script
- zera o `PATCH` automaticamente no script
- registra o inicio do novo ciclo nos `package.json`
- regenera `app-version.ts` em modo de desenvolvimento

### Promocao de `dev` para `main`

Esse fluxo:

- calcula a versao de release atual
- faz merge `--ff-only` de `dev` para `main`
- regenera `app-version.ts` em modo de producao
- cria a tag da release no estado final preparado para producao

Validacoes aplicadas:

- arvore local precisa estar limpa
- `dev` e `main` precisam existir localmente
- `main` precisa ser ancestral de `dev` para permitir `--ff-only`
- frontend e backend precisam estar com a mesma base de versao
- frontend e backend precisam estar com o mesmo inicio de ciclo
- a tag de release nao pode existir localmente

Observacao:

- o push para `origin` continua manual, de proposito, para manter a publicacao sob controle
- os arquivos `src/generated/app-version.ts` de frontend e backend sao artefatos gerados e nao precisam ser versionados no Git
