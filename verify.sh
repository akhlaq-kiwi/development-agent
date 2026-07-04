#!/usr/bin/env bash

# verify.sh - Code verification script for Antigravity Builder
# Runs local compilation and unit tests before any commits or PRs are created.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${PROJECT_DIR:-$(dirname "$SCRIPT_DIR")}"

echo "=================================================="
echo " Running Code Verification Suite..."
echo "=================================================="

# 1. Compile Frontend
if [ -d "$PROJECT_ROOT/frontend" ]; then
  echo ">>> Verifying Frontend build..."
  (
    cd "$PROJECT_ROOT/frontend"
    npm install
    npm run build
  )
else
  echo "Error: frontend directory not found." >&2
  exit 1
fi

# 2. Run Frontend Tests
if [ -d "$PROJECT_ROOT/frontend" ]; then
  echo ">>> Running Frontend unit tests..."
  (
    cd "$PROJECT_ROOT/frontend"
    npm run test
  )
fi

# 3. Run Backend Tests
if [ -d "$PROJECT_ROOT/backend" ]; then
  echo ">>> Running Backend unit tests..."
  # Determine if Docker is running and slim-app is available
  if command -v docker &>/dev/null && docker compose ps --format json 2>/dev/null | grep -q "slim-app"; then
    echo "Running PHPUnit inside running Docker slim-app container..."
    docker compose exec -T app vendor/bin/phpunit
  else
    echo "Docker slim-app is not running. Running PHPUnit locally (if php exists)..."
    if command -v php &>/dev/null; then
      (
        cd "$PROJECT_ROOT/backend"
        composer install
        vendor/bin/phpunit
      )
    else
      echo "Warning: php not found locally and Docker is not running. Skipping PHPUnit tests."
    fi
  fi
fi

echo "=================================================="
echo "✓ All verifications passed successfully!"
echo "=================================================="
