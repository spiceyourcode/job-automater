#!/usr/bin/env bash
# Validates Drizzle schema file exists when api/ is scaffolded.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCHEMA="$ROOT/api/src/db/schema"

if [ ! -d "$ROOT/api" ]; then
  echo "SKIP: api/ not scaffolded yet"
  exit 0
fi

if [ ! -d "$SCHEMA" ] || [ -z "$(find "$SCHEMA" -name '*.ts' 2>/dev/null | head -1)" ]; then
  echo "FAIL: No Drizzle schema in api/src/db/schema/"
  exit 1
fi

echo "OK: Drizzle schema present"
exit 0
