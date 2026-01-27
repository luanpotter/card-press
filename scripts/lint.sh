#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
NC='\033[0m'

FAILED=0

run_check() {
  local name="$1"
  shift
  echo -e "${BLUE}▶ Running:${NC} $name"
  if "$@"; then
    echo -e "${GREEN}✓ Passed:${NC} $name\n"
  else
    echo -e "${RED}✗ Failed:${NC} $name\n"
    FAILED=1
  fi
}

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}                    Running All Checks                       ${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

# TypeScript type checking
run_check "TypeScript (tsc --noEmit)" bun run tsc --noEmit

# ESLint
run_check "ESLint" bun run eslint src

# Prettier formatting check
run_check "Prettier" bun run prettier --check src

# Build check (ensures the project actually builds)
run_check "Build" bun run build

# Check for unused dependencies (if depcheck is available)
if command -v bunx &> /dev/null; then
  run_check "Unused Dependencies" bunx depcheck --ignores="@types/*,jiti,globals,bun"
fi

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if [ "$FAILED" -eq 0 ]; then
  echo -e "${GREEN}✓ All checks passed!${NC}"
  exit 0
else
  echo -e "${RED}✗ Some checks failed!${NC}"
  exit 1
fi
