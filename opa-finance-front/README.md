# Opa Finance Front

Frontend do sistema Opa Finance, construído com React + Vite (rolldown-vite),
TypeScript e Tailwind CSS v4.

Este frontend é composto por rotas (UI), features (hooks e tipos por domínio) e camada de integração com API/validação.

Este frontend depende do backend em execução para autenticação e dados.

## Stack

- React 19
- Vite (rolldown-vite)
- TypeScript
- Tailwind CSS v4 (CSS-first)
- TanStack Router + TanStack Query
- shadcn/ui
- Axios
- Zod
- React Hook Form
- Radix UI
- Zustand
- Lucide Icons
- ESLint + Prettier

## Arquitetura

- Feature-based architecture: hooks e tipos ficam em `src/features/*`.
- Rotas (`src/routes/*`) concentram a UI e a orquestracao.

## Responsividade

- Breakpoint principal de desktop: **960px**.
- Utilitarios customizados em `src/index.css`:
  - `desktop-only` (exibe apenas >= 960px)
  - `mobile-only` (exibe apenas < 960px)
  - `desktop-force-block` (forca bloco no desktop mesmo com `hidden`)

## Transfers

- Transferencias sao criadas na tela de transacoes (modal dedicado).
- Fluxo usa os hooks em `src/features/transfers` e schema em `src/schemas/transfer.schema.ts`.

## ✅ Pré-requisitos

- Node.js 18+
- npm 9+
- Backend em execução (API)

## ⚙️ Variáveis de ambiente

Crie o arquivo `.env.local` na raiz do frontend (`opa-finance-front/`) com:

```
VITE_API_URL=http://localhost:3333
```

> Ajuste o valor para a URL do backend (local ou remoto).

## 🚀 Como rodar

1. Instalar dependências
  - `npm install`
2. Iniciar app
  - `npm run dev`

## 🏗 Build e preview

- `npm run build` — gera o build de produção
- `npm run preview` — pré-visualiza o build

## 📦 Deploy

- Build gera a pasta `dist/`.
- Para SPA, configure o servidor (ex.: Nginx) para fallback em `index.html`.
- Para proxy com backend, recomenda-se expor a API via `/api` e ajustar `VITE_API_URL`.

## Scripts

- `npm run dev` - ambiente de desenvolvimento
- `npm run build` - build de producao
- `npm run preview` - preview do build
- `npm run lint` - lint do projeto
- `npm run lint:fix` - lint com fix
- `npm run format` - formatacao com Prettier

## Tema

- Tema claro/escuro com tokens em `src/index.css`.
- `ThemeProvider` aplica classe `dark` no `html` e salva no `localStorage`.
- Toggle no sidebar e na tela de login.

## Documentacao

- [doc/FRONTEND_GUIDE.md](doc/FRONTEND_GUIDE.md)
- [doc/FRONTEND_REGRAS_DE_NEGOCIO.md](doc/FRONTEND_REGRAS_DE_NEGOCIO.md)
- [doc/API_REFERENCE_FRONTEND.md](doc/API_REFERENCE_FRONTEND.md) (fonte única no backend: [opa-finance-api/docs/API_REFERENCE_FRONTEND.md](../opa-finance-api/docs/API_REFERENCE_FRONTEND.md))

## 👨‍💻 Autor

**Bruno S Velho**
- Email: bruno.velho@gmail.com
- GitHub: https://github.com/vbruno
- LinkedIn: https://www.linkedin.com/in/brunovelho/
