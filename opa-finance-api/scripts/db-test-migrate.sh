#!/usr/bin/env bash

set -e
set -a
. "$(cd "$(dirname "$0")/.." && pwd)/.env"
set +a

: "${DATABASE_URL_TEST:?DATABASE_URL_TEST nao definido no .env}"

export DATABASE_URL="$DATABASE_URL_TEST"

npx drizzle-kit migrate
