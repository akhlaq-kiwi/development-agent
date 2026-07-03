#!/usr/bin/env bash

# deploy.sh - Deployment Script for Antigravity Builder
# Builds frontend locally and deploys frontend/backend to remote server via SSH/rsync.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load environment variables from builder/.env
ENV_PATH="$SCRIPT_DIR/.env"
if [ -f "$ENV_PATH" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    line=$(echo "$line" | tr -d '\r')
    if [[ "$line" =~ ^[[:space:]]*# ]] || [[ -z "$line" ]]; then
      continue
    fi
    if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
      export "$line"
    fi
  done < "$ENV_PATH"
else
  echo "Error: .env configuration file not found at $ENV_PATH" >&2
  exit 1
fi

# Verify required deployment variables
if [ -z "${SSH:-}" ]; then
  echo "Error: SSH environment variable is not set in .env" >&2
  exit 1
fi

if [ -z "${REMOTE_DIR:-}" ]; then
  echo "Error: REMOTE_DIR environment variable is not set in .env" >&2
  exit 1
fi

PROJECT_ROOT="${PROJECT_DIR:-$(dirname "$SCRIPT_DIR")}"
CODE_DIR="$PROJECT_ROOT"

echo "=================================================="
echo " Starting Deploy Script for QA Environment..."
echo " Target Directory: $REMOTE_DIR"
echo "=================================================="

# 1. Build Frontend Locally
echo ">>> Building Frontend..."
if [ -d "$CODE_DIR/frontend" ]; then
  cd "$CODE_DIR/frontend"
  
  echo "Installing frontend packages..."
  npm install
  
  echo "Configuring production environment for QA..."
  # Create a production .env file for the frontend compilation pointing to the /api context
  echo "VITE_API_URL=https://at-qa.shikshapilot.com/api" > .env.production
  
  echo "Running Vite production build..."
  npm run build
  
  # Clean up the temporary env file
  rm -f .env.production
else
  echo "Error: Frontend directory not found at $CODE_DIR/frontend" >&2
  exit 1
fi

# 2. Extract SSH user and host for rsync
# SSH is "ssh -p 65002 u554613359@92.249.46.170"
# We extract the user@host part (the last argument of SSH command)
SSH_HOST=$(echo "$SSH" | awk '{print $NF}')

echo ">>> Deploying Frontend assets to root..."
# Sync frontend/dist/ to remote root using the custom SSH command for transport
rsync -avz -e "$SSH" --delete "$CODE_DIR/frontend/dist/" "$SSH_HOST:$REMOTE_DIR/"

echo ">>> Preparing remote API folder..."
# Create the api folder on the remote server
$SSH "mkdir -p $REMOTE_DIR/api"

echo ">>> Deploying Backend source to /api..."
# Sync backend/ to remote api/ folder, excluding vendor dependencies and local logs/caches
rsync -avz -e "$SSH" \
  --exclude 'vendor/' \
  --exclude 'logs/*.log' \
  --exclude '.git' \
  --exclude '.env' \
  --exclude '.env.*' \
  --exclude '.phpunit.result.cache' \
  --exclude '.phpunit.cache/' \
  "$CODE_DIR/backend/" "$SSH_HOST:$REMOTE_DIR/api/"

echo ">>> Uploading QA Database credentials..."
# Upload the local .env.qa file to the remote server as the active .env configuration
cat "$CODE_DIR/.env.qa" | $SSH "cat > $REMOTE_DIR/api/.env"

echo ">>> Running server-side installs and database migrations..."
# Run Composer install and Phinx migrations on the remote server
$SSH "cd $REMOTE_DIR/api && composer install --no-dev --optimize-autoloader && php vendor/bin/phinx migrate"

echo "=================================================="
echo "✓ QA Deployment Completed Successfully!"
echo "=================================================="
