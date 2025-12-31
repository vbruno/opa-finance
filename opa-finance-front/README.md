# Opa Finance Front

Frontend do sistema Opa Finance, construido com React + Vite (rolldown-vite),
TypeScript e Tailwind CSS v4.

## Stack

- React 19
- Vite (rolldown-vite)
- TypeScript
- Tailwind CSS v4 (CSS-first)
- TanStack Router + TanStack Query
- shadcn/ui

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
- Toggle no header e na tela de login.

## Documentacao

- `doc/FRONTEND_GUIDE.md`
- `doc/FRONTEND_REGRAS_DE_NEGOCIO.md`
- `doc/API_REFERENCE_FRONTEND.md` (fonte unica no backend: `../opa-finance-api/docs/API_REFERENCE_FRONTEND.md`)
