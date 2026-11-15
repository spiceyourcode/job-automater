#!/bin/bash
# Agentic Tool: RBAC Middleware Validator
# Parses route files to ensure protected routes declare RBAC middleware.
# Exit code 1 on violation.

set -euo pipefail

echo "=== RBAC Validation ==="
BACKEND_DIR="backend/src/modules"

if [ ! -d "$BACKEND_DIR" ]; then
  echo "⚠️  WARNING: $BACKEND_DIR not found. Skipping validation."
  exit 0
fi

VIOLATIONS=0

echo "--- Checking: Every protected route has RBAC middleware ---"

ROUTE_FILES=$(find "$BACKEND_DIR" -name "*.routes.ts" 2>/dev/null || true)

if [ -z "$ROUTE_FILES" ]; then
  echo "ℹ️  No route files found yet. Skipping."
  exit 0
fi

while IFS= read -r file; do
  [ -z "$file" ] && continue
  echo "Checking: $file"

  ROUTES=$(grep -n "app\.\(get\|post\|put\|patch\|delete\)(" "$file" 2>/dev/null || true)

  while IFS= read -r route; do
    [ -z "$route" ] && continue
    LINE_NUM=$(echo "$route" | cut -d: -f1)
    ROUTE_DEF=$(echo "$route" | cut -d: -f2-)

    if echo "$ROUTE_DEF" | grep -qE "(public|health|_public|open)"; then
      continue
    fi

    HAS_RBAC=$(sed -n "${LINE_NUM},+10p" "$file" | grep -c "requireRole\|requireRoles" || true)

    if [ "$HAS_RBAC" -eq 0 ]; then
      ROUTE_CONTEXT=$(sed -n "${LINE_NUM},$((LINE_NUM + 3))p" "$file" | tr '\n' ' ')
      if echo "$ROUTE_CONTEXT" | grep -qE "login|register|verify|forgot|reset|logout|refresh|webhook|callback|public|health|status|version"; then
        continue
      fi
      echo "❌ VIOLATION: Possible missing RBAC at line $LINE_NUM"
      echo "   Route: $ROUTE_DEF"
      VIOLATIONS=$((VIOLATIONS + 1))
    fi
  done <<< "$ROUTES"
done <<< "$ROUTE_FILES"

if [ "$VIOLATIONS" -gt 0 ]; then
  echo ""
  echo "❌ FAILED: $VIOLATIONS route(s) may be missing RBAC middleware."
  exit 1
fi

echo ""
echo "✅ PASS: All routes appear to have proper RBAC middleware."
exit 0
