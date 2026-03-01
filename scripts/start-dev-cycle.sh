#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRANCH_NAME="${1:-dev}"

cd "$ROOT_DIR"

if ! git diff --quiet --ignore-submodules HEAD --; then
  echo "Erro: existe mudanca nao commitada. Limpe a arvore antes de iniciar um novo ciclo."
  exit 1
fi

if ! git show-ref --verify --quiet "refs/heads/main"; then
  echo "Erro: a branch local 'main' nao existe."
  exit 1
fi

git checkout main

if git show-ref --verify --quiet "refs/heads/$BRANCH_NAME"; then
  git checkout "$BRANCH_NAME"
  git merge --ff-only main
else
  git checkout -b "$BRANCH_NAME" main
fi

node "$ROOT_DIR/scripts/version-start-dev-cycle.mjs" "$BRANCH_NAME"
NODE_ENV=development node "$ROOT_DIR/opa-finance-front/scripts/generate-version.mjs"
NODE_ENV=development node "$ROOT_DIR/opa-finance-api/scripts/generate-version.mjs"

echo
echo "Ciclo de desenvolvimento pronto na branch '$BRANCH_NAME'."
echo "Proximo passo sugerido:"
echo "  git add ."
echo "  git commit -m \"chore: inicia ciclo ${BRANCH_NAME}\""
