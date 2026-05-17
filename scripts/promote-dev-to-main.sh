#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEV_BRANCH="${1:-dev}"

cd "$ROOT_DIR"

if [ "$DEV_BRANCH" = "main" ]; then
  echo "Erro: DEV_BRANCH nao pode ser 'main' neste fluxo."
  exit 1
fi

tem_remote_origin() {
  git remote get-url origin >/dev/null 2>&1
}

garantir_branch_local_sincronizada_com_origin() {
  local BRANCH="$1"

  if ! git show-ref --verify --quiet "refs/heads/$BRANCH"; then
    return 0
  fi

  if ! git show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
    return 0
  fi

  local AHEAD
  local BEHIND
  read -r AHEAD BEHIND < <(git rev-list --left-right --count "$BRANCH...origin/$BRANCH")

  if [ "$AHEAD" -eq 0 ] && [ "$BEHIND" -eq 0 ]; then
    return 0
  fi

  echo "Erro: branch local '$BRANCH' fora de sincronia com 'origin/$BRANCH'."
  echo "  Commits locais nao enviados: $AHEAD"
  echo "  Commits remotos nao trazidos: $BEHIND"
  echo "Sincronize antes de continuar."
  echo "Sugestao:"
  echo "  git checkout $BRANCH"
  echo "  git pull --ff-only origin $BRANCH"
  exit 1
}

escolher_tipo_release() {
  echo ""
  echo "Tipo de release:"
  echo "  1) Correcao / pequena melhoria (PATCH)"
  echo "  2) Atualizacao de modulo / grande entrega (MINOR)"
  echo "  0) Cancelar"
  echo ""

  read -r -p "Escolha uma opcao (0/1/2): " RELEASE_OPTION

  case "$RELEASE_OPTION" in
    1)
      RELEASE_KIND="patch"
      ;;
    2)
      RELEASE_KIND="minor"
      ;;
    0)
      echo "Operacao cancelada."
      exit 0
      ;;
    *)
      echo "Erro: opcao invalida."
      exit 1
      ;;
  esac
}

preparar_release_minor() {
  local TARGET_VERSION="$1"

  git checkout "$DEV_BRANCH"

  node - "$ROOT_DIR" "$TARGET_VERSION" <<'EOF'
const { execSync } = require('node:child_process')
const { readFileSync, writeFileSync } = require('node:fs')
const { resolve } = require('node:path')

const rootDir = process.argv[2]
const targetVersion = process.argv[3]
const packageJsonPaths = [
  resolve(rootDir, 'opa-finance-front/package.json'),
  resolve(rootDir, 'opa-finance-api/package.json'),
]

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf-8'))
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function getCommitCount() {
  return Number(
    execSync('git rev-list --count HEAD', {
      cwd: rootDir,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim(),
  )
}

const nextCommitCount = getCommitCount() + 1

for (const packageJsonPath of packageJsonPaths) {
  const packageJson = readJson(packageJsonPath)
  packageJson.version = targetVersion
  packageJson.versioning = {
    ...(packageJson.versioning ?? {}),
    cycleStartCommitCount: nextCommitCount,
  }
  writeJson(packageJsonPath, packageJson)
}
EOF

  git add "$ROOT_DIR/opa-finance-front/package.json" "$ROOT_DIR/opa-finance-api/package.json"

  if git diff --cached --quiet -- "$ROOT_DIR/opa-finance-front/package.json" "$ROOT_DIR/opa-finance-api/package.json"; then
    echo "Erro: release MINOR nao gerou alteracao de versao para commit."
    exit 1
  fi

  git commit -m "chore: prepara release v${TARGET_VERSION}"
}

if ! git diff --quiet --ignore-submodules HEAD --; then
  echo "Erro: existe mudanca nao commitada. Limpe a arvore antes de promover a release."
  exit 1
fi

if ! git show-ref --verify --quiet "refs/heads/$DEV_BRANCH"; then
  echo "Erro: a branch '$DEV_BRANCH' nao existe localmente."
  exit 1
fi

if ! git show-ref --verify --quiet "refs/heads/main"; then
  echo "Erro: a branch 'main' nao existe localmente."
  exit 1
fi

if tem_remote_origin; then
  git fetch origin --prune
  garantir_branch_local_sincronizada_com_origin "main"
  garantir_branch_local_sincronizada_com_origin "$DEV_BRANCH"
fi

if ! git merge-base --is-ancestor main "$DEV_BRANCH"; then
  echo "Erro: 'main' nao e ancestral de '$DEV_BRANCH'."
  echo "Resolva o historico antes de promover a release."
  exit 1
fi

read -r PATCH_RELEASE_VERSION MINOR_RELEASE_VERSION < <(node - "$ROOT_DIR" "$DEV_BRANCH" <<'EOF'
const { execSync } = require('node:child_process')
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')

const rootDir = process.argv[2]
const devBranch = process.argv[3]

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf-8'))
}

function getCommitCount(branchName) {
  return Number(
    execSync(`git rev-list --count ${branchName}`, {
      cwd: rootDir,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim(),
  )
}

function getReleaseVersion(packageJson) {
  const totalCommits = getCommitCount(devBranch)
  const cycleStart = Number(packageJson.versioning?.cycleStartCommitCount ?? 0)
  const [major = '0', minor = '0'] = String(packageJson.version || '0.0.0').split('.')
  return `${major}.${minor}.${Math.max(totalCommits - cycleStart, 0)}`
}

function getNextMinorVersion(packageJson) {
  const [major = '0', minor = '0'] = String(packageJson.version || '0.0.0').split('.')
  return `${major}.${Number(minor) + 1}.0`
}

const frontPkg = readJson(resolve(rootDir, 'opa-finance-front/package.json'))
const apiPkg = readJson(resolve(rootDir, 'opa-finance-api/package.json'))

if (String(frontPkg.version || '') !== String(apiPkg.version || '')) {
  console.error('Erro: frontend e backend estao com bases de versao diferentes.')
  process.exit(10)
}

if (
  Number(frontPkg.versioning?.cycleStartCommitCount ?? 0) !==
  Number(apiPkg.versioning?.cycleStartCommitCount ?? 0)
) {
  console.error('Erro: frontend e backend estao com inicios de ciclo diferentes.')
  process.exit(11)
}

process.stdout.write(`${getReleaseVersion(apiPkg)} ${getNextMinorVersion(apiPkg)}`)
EOF
)

escolher_tipo_release

if [ "$RELEASE_KIND" = "minor" ]; then
  RELEASE_VERSION="$MINOR_RELEASE_VERSION"
  RELEASE_KIND_LABEL="MINOR"
else
  RELEASE_VERSION="$PATCH_RELEASE_VERSION"
  RELEASE_KIND_LABEL="PATCH"
fi

TAG_NAME="v${RELEASE_VERSION}"

if git rev-parse "$TAG_NAME" >/dev/null 2>&1; then
  echo "Erro: a tag '$TAG_NAME' ja existe localmente."
  exit 1
fi

if tem_remote_origin && git ls-remote --tags --exit-code origin "refs/tags/$TAG_NAME" >/dev/null 2>&1; then
  echo "Erro: a tag '$TAG_NAME' ja existe no remoto 'origin'."
  exit 1
fi

MAIN_SHA="$(git rev-parse --short main)"
DEV_SHA="$(git rev-parse --short "$DEV_BRANCH")"

echo "Release calculada: ${RELEASE_VERSION}"
echo "Tipo de release: ${RELEASE_KIND_LABEL}"
echo "Branch origem: ${DEV_BRANCH} (${DEV_SHA})"
echo "Branch destino: main (${MAIN_SHA})"
echo "Tag a ser criada: ${TAG_NAME}"
if [ "$RELEASE_KIND" = "minor" ]; then
  echo "Sera criado um commit de versao em '${DEV_BRANCH}' antes do merge."
fi
printf "Confirmar merge de '%s' para 'main' e criar tag '%s'? [y/N] " "$DEV_BRANCH" "$TAG_NAME"
read -r CONFIRM

if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  echo "Operacao cancelada."
  exit 0
fi

if [ "$RELEASE_KIND" = "minor" ]; then
  preparar_release_minor "$RELEASE_VERSION"
fi

git checkout main
git merge --ff-only "$DEV_BRANCH"

NODE_ENV=production node "$ROOT_DIR/opa-finance-front/scripts/generate-version.mjs"
NODE_ENV=production node "$ROOT_DIR/opa-finance-api/scripts/generate-version.mjs"

git tag -a "$TAG_NAME" -m "Release ${TAG_NAME}"

echo
echo "Release preparada em 'main' com tag '${TAG_NAME}'."
echo "Verificacoes aplicadas:"
echo "  - arvore local limpa"
echo "  - branches '$DEV_BRANCH' e 'main' existentes"
echo "  - merge fast-forward valido"
echo "  - bases de versao e ciclo alinhados entre frontend e backend"
echo "  - tag local inexistente antes da criacao"
echo "  - tipo de release escolhido explicitamente (${RELEASE_KIND_LABEL})"
echo "  - arquivos de versao regenerados localmente antes da tag"

if ! tem_remote_origin; then
  git branch -d "$DEV_BRANCH"

  echo
  echo "Remote 'origin' nao configurado. Push nao pode ser executado automaticamente."
  echo "Branch local '${DEV_BRANCH}' removida."
  exit 0
fi

echo
printf "Deseja publicar agora no remoto 'origin' (main + tag %s)? [Y/n] " "$TAG_NAME"
read -r PUSH_CONFIRM

if [[ "$PUSH_CONFIRM" =~ ^[Nn]$ ]]; then
  git branch -d "$DEV_BRANCH"

  echo
  echo "Push pulado por escolha do usuario."
  echo "Branch local '${DEV_BRANCH}' removida."
  echo "Para publicar manualmente:"
  echo "  git push origin main"
  echo "  git push origin ${TAG_NAME}"
  echo "  git push origin --delete ${DEV_BRANCH}"
  exit 0
fi

git push origin main
git push origin "$TAG_NAME"

if git show-ref --verify --quiet "refs/remotes/origin/$DEV_BRANCH"; then
  git push origin --delete "$DEV_BRANCH"
fi

git branch -d "$DEV_BRANCH"

echo
echo "Push concluido com sucesso:"
echo "  - main em origin/main"
echo "  - tag ${TAG_NAME} em origin"
echo "  - branch local '${DEV_BRANCH}' removida"
if git remote get-url origin >/dev/null 2>&1; then
  echo "  - branch remota '${DEV_BRANCH}' removida (se existia em origin)"
fi
