# Módulo: Categories

## Responsabilidades

- Criar categorias
- Editar categorias
- Excluir categorias
- Listar categorias
- Registrar descrição opcional para apoiar entendimento do usuário
- Criar/editar/listar/remover subcategorias

## Regras

- Categoria obrigatória em transações
- Não excluir se usada
- Personalizadas por usuário
- `description` é opcional e pode ser `null`
- Categorias de sistema são somente leitura para alteração/remoção
- Subcategoria herda vínculo da categoria e também aceita `description` opcional
- Categoria/subcategoria com recorrência `active` vinculada não pode ser removida

## Campos

- `name` (string, obrigatório)
- `description` (string, opcional, até 500 caracteres, nullable)
- `type` (`income` | `expense`, obrigatório)
- `color` (string, opcional, nullable)

## Subcategorias - Campos

- `categoryId` (uuid, obrigatório)
- `name` (string, obrigatório)
- `description` (string, opcional, até 500 caracteres, nullable)
- `color` (string HEX, opcional, nullable em update)
