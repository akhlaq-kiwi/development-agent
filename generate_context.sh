#!/usr/bin/env bash

# generate_context.sh - Generates a compact project context representation for the agent.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${PROJECT_DIR:-$(dirname "$SCRIPT_DIR")}"

echo "Generating compact project context..." >&2

# 1. Try to use graphify if installed
if command -v graphify &>/dev/null; then
  echo "Using Graphify to build structured context..." >&2
  (
    cd "$PROJECT_ROOT"
    graphify build . --output-dir "$SCRIPT_DIR/graphify-out" &>/dev/null || true
  )
  if [ -f "$SCRIPT_DIR/graphify-out/GRAPH_REPORT.md" ]; then
    cat "$SCRIPT_DIR/graphify-out/GRAPH_REPORT.md"
    exit 0
  fi
fi

# Fallback: Generate custom compact context
echo "### Project Directory Structure"
(
  cd "$PROJECT_ROOT"
  if command -v tree &>/dev/null; then
    tree -I 'node_modules|vendor|dist|.git|logs|uploads' -L 3
  else
    # Simple find-based fallback
    find . -maxdepth 3 \
      -not -path '*/.*' \
      -not -path './frontend/node_modules*' \
      -not -path './backend/vendor*' \
      -not -path './frontend/dist*' \
      -not -path './backend/logs*' \
      -not -path './backend/public/uploads*' | sort
  fi
)

echo ""
echo "### Backend Routes"
if [ -f "$PROJECT_ROOT/backend/config/routes.php" ]; then
  grep -E '\$app->(get|post|put|delete|patch|group)\(' "$PROJECT_ROOT/backend/backend/config/routes.php" 2>/dev/null || \
  grep -E '\$app->(get|post|put|delete|patch|group)\(' "$PROJECT_ROOT/backend/config/routes.php" 2>/dev/null || true
fi

echo ""
echo "### Frontend Routes"
if [ -f "$PROJECT_ROOT/frontend/src/routes/index.tsx" ]; then
  grep -E '<Route\s+path=' "$PROJECT_ROOT/frontend/src/routes/index.tsx" || true
fi

echo ""
echo "### Database Tables & Schema (Phinx Migrations)"
if [ -d "$PROJECT_ROOT/backend/db/migrations" ]; then
  ls -la "$PROJECT_ROOT/backend/db/migrations" | awk '{print $9}' | grep -v '^\.$' | grep -v '^\.\.$' 2>/dev/null || true
fi
