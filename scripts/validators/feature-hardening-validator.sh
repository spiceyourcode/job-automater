#!/bin/bash
# Agentic Tool: High-Risk Feature Hardening Validator
# Customize SEARCH patterns for your high-risk UI component.
# Exit code 1 on violation. Exits 0 if component not found yet.

set -euo pipefail

echo "=== High-Risk Feature Hardening Validation ==="

# Adjust glob to match your protected viewer / sensitive UI component
FEATURE_FILE=$(find "frontend/src" \
  \( -iname "*protected*viewer*" -o -iname "*secure*viewer*" -o -iname "*high*risk*" \) \
  2>/dev/null | head -1 || true)

if [ -z "${FEATURE_FILE:-}" ]; then
  echo "⚠️  WARNING: No high-risk feature component found. Skipping validation."
  exit 0
fi

echo "Found: $FEATURE_FILE"
VIOLATIONS=0

check() {
  local label="$1"
  local pattern="$2"
  if grep -Eqi "$pattern" "$FEATURE_FILE" 2>/dev/null; then
    echo "✅ PASS: $label"
  else
    echo "❌ VIOLATION: $label not detected"
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
}

# Customize these checks to match your PRD hardening list
check "Canvas / controlled render" "canvas|Canvas|getContext|canvasRef"
check "Identity watermark / overlay" "watermark|userId|overlay"
check "Context-menu interception" "contextmenu|preventDefault"
check "Print interception" "onbeforeprint|beforeprint|@media print"
check "Select / callout deterrents" "user-select|webkit-user-select|webkit-touch-callout"
check "Blur on visibility change" "visibilitychange|visibilityState|document\.hidden"

if [ "$VIOLATIONS" -gt 0 ]; then
  echo ""
  echo "❌ FAILED: $VIOLATIONS hardening violation(s)."
  echo "   Reference: docs/agent/skills/safety-moderation-skill.md"
  exit 1
fi

echo ""
echo "✅ PASS: Hardening measures detected."
exit 0
