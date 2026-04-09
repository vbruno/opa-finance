# Módulo: Reports

## Responsabilidades

- Gerar fluxo semanal por ano
- Gerar consolidado mensal por ano
- Expor anos com movimentação para o consolidado
- Suportar filtro por conta(s)
- Suportar visão com projeção (`forecast`) quando habilitada

## Regras

- Todas as rotas exigem autenticação
- Dados sempre isolados por usuário
- `year` é obrigatório nas consultas de relatório principal
- `accountIds` é opcional e aceita lista separada por vírgula
- Fluxo semanal retorna colunas fixas (`total`, `received`, `spent`) e catálogo de colunas dinâmicas
- Consolidado retorna estrutura por tipo (`income`/`expense`), categoria, subcategoria e totais anuais

## Endpoints

- `GET /reports/weekly-cashflow`
- `GET /reports/consolidated/years`
- `GET /reports/consolidated`
