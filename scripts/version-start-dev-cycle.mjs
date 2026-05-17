import { execSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = resolve(__dirname, '..')

function getCurrentBranch() {
  return execSync('git branch --show-current', {
    cwd: rootDir,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim()
}

const expectedBranch = process.argv[2] || 'dev'
const currentBranch = getCurrentBranch()

if (currentBranch !== expectedBranch) {
  console.error(
    `Erro: execute este script na branch '${expectedBranch}'. Branch atual: '${currentBranch}'.`,
  )
  process.exit(1)
}

console.log(`Ciclo neutro preparado em '${expectedBranch}'.`)
console.log('Nenhum bump de versao foi aplicado; PATCH/MINOR sera decidido na promocao.')
