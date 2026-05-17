# Contrato de Versionamento

Este projeto adota um versionamento operacional simples, automatico no `PATCH` e com decisao manual de `MINOR` somente na promocao para producao.

## Regras

- `main` e sempre a branch de producao.
- `dev` representa o ciclo atual de desenvolvimento.
- A versao segue o formato `MAJOR.MINOR.PATCH`.
- `MAJOR` sobe manualmente quando houver mudanca grande fora do fluxo normal.
- `MINOR` sobe quando a promocao para producao for classificada como atualizacao de modulo/grande entrega.
- `PATCH` e incrementado automaticamente conforme os commits do ciclo atual.
- `dev` e neutra: ao recriar a branch, ainda nao se decide se a proxima release sera `PATCH` ou `MINOR`.

## Formato por ambiente

- Desenvolvimento: `MAJOR.MINOR.PATCH-dev`
- Producao: `MAJOR.MINOR.PATCH`

Exemplo:

- Em desenvolvimento: `1.1.3-dev`
- Em producao: `1.1.3`

## Ciclo de release

1. A producao atual esta em `main`, por exemplo `1.4.4`.
2. Ao iniciar um novo ciclo, cria-se ou atualiza-se a branch `dev` sem bump de versao.
3. O primeiro estado do novo ciclo fica `1.4.4-dev`.
4. A cada commit no ciclo atual, o `PATCH` aumenta automaticamente:
   - `1.4.5-dev`
   - `1.4.6-dev`
   - `1.4.7-dev`
5. Quando o ciclo estiver estavel, o operador escolhe o tipo de release na promocao para `main`.
6. Se for correcao ou pequena melhoria, publica como `PATCH`:
   - `1.4.7`
7. Se for atualizacao de modulo ou grande entrega, publica como `MINOR`:
   - `1.5.0`

## Responsabilidades

Manual:

- Definir o `MAJOR`
- Decidir quando um novo ciclo deve comecar
- Classificar a release como `PATCH` ou `MINOR` na promocao para `main`
- Criar a tag Git de release em `main`

Observacao importante:

- O inicio de um novo ciclo nao muda `MAJOR.MINOR`.
- A decisao entre `PATCH` e `MINOR` acontece somente ao promover `dev` para `main`.
- Quando a release for `MINOR`, o script `./scripts/version-cycle.sh` cria um commit de versao em `dev` antes do merge para `main`.
- Exemplo: depois de desenvolver em `1.4.7-dev`, a promocao pode publicar `1.4.7` como `PATCH` ou `1.5.0` como `MINOR`.

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

- Novo ciclo de desenvolvimento: recria/atualiza `dev` sem bump de versao
- Durante desenvolvimento: `PATCH` sobe sozinho por commit
- Publicacao em `main`: operador escolhe `PATCH` ou `MINOR`
- Release `PATCH`: remove `-dev`
- Release `MINOR`: sobe `MINOR`, zera `PATCH` e cria commit de versao antes do merge
- Release publicada: cria tag Git na `main`

## Script interativo

Use o menu interativo:

```bash
./scripts/version-cycle.sh
```

Opcoes disponiveis:

- preparar `dev` para novo ciclo neutro
- promover `dev` para `main` escolhendo `PATCH` ou `MINOR`
- mostrar a versao calculada atual

Internamente, esse fluxo reaproveita os scripts operacionais abaixo:

- `scripts/start-dev-cycle.sh`
- `scripts/promote-dev-to-main.sh`

### Preparar novo ciclo neutro em `dev`

Esse fluxo:

- troca para `main`
- cria ou atualiza a branch `dev`
- nao altera `MAJOR.MINOR`
- nao altera `cycleStartCommitCount`
- regenera `app-version.ts` em modo de desenvolvimento

### Promocao de `dev` para `main`

Esse fluxo:

- calcula a versao de release atual
- pergunta se a release sera `PATCH` ou `MINOR`
- em `PATCH`, mantem `MAJOR.MINOR` e publica o `PATCH` calculado pelos commits
- em `MINOR`, atualiza os `package.json`, zera `PATCH` e cria um commit de versao em `dev`
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
- o tipo de release precisa ser escolhido explicitamente

Observacao:

- o push para `origin` continua manual, de proposito, para manter a publicacao sob controle
- os arquivos `src/generated/app-version.ts` de frontend e backend sao artefatos gerados e nao precisam ser versionados no Git
