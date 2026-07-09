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

# Strip surrounding quotes from SSH and REMOTE_DIR if they exist
SSH=$(echo "${SSH:-}" | sed -e 's/^"//' -e 's/"$//')
REMOTE_DIR=$(echo "${REMOTE_DIR:-}" | sed -e 's/^"//' -e 's/"$//')

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

# Workflow and action flags (defaulting to env settings or true)
DEPLOY_CODE="${DEPLOY_CODE_ON_SERVER:-true}"
RUN_MIGRATIONS="${RUN_MIGRATIONS_ON_SERVER:-true}"

# Parse command line options
for arg in "$@"; do
  case "$arg" in
    --migrations-only|-m)
      DEPLOY_CODE=false
      RUN_MIGRATIONS=true
      ;;
    --skip-migrations|-s)
      DEPLOY_CODE=true
      RUN_MIGRATIONS=false
      ;;
    *)
      ;;
  esac
done

echo "=================================================="
echo " Starting Deploy Script for QA Environment..."
echo " Target Directory: $REMOTE_DIR"
echo " Deploy Code:      $DEPLOY_CODE"
echo " Run Migrations:   $RUN_MIGRATIONS"
echo "=================================================="

# 1. Build & Sync Code
if [ "$DEPLOY_CODE" = "true" ]; then
  echo ">>> Building Frontend..."
  if [ -d "$CODE_DIR/frontend" ]; then
    cd "$CODE_DIR/frontend"
    
    echo "Installing frontend packages..."
    npm install
    
    echo "Configuring production environment for QA..."
    # Create a production .env file for the frontend compilation pointing to the /api context
    printf "VITE_API_URL=https://at-qa.shikshapilot.com/api\nVITE_UPLOADED_BASE_URL=https://at-qa.shikshapilot.com/api/uploads\n" > .env.production
    
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
  # Extract the transport part (everything except the last argument) for rsync -e
  RSYNC_SSH=$(echo "$SSH" | sed 's/ [^ ]*$//')

  echo ">>> Deploying Frontend assets to root..."
  # Sync frontend/dist/ to remote root using the custom SSH command for transport
  rsync -avz -e "$RSYNC_SSH" --delete "$CODE_DIR/frontend/dist/" "$SSH_HOST:$REMOTE_DIR/"

  echo ">>> Preparing remote API folder..."
  # Create the api folder on the remote server
  $SSH "mkdir -p $REMOTE_DIR/api"

  echo ">>> Deploying Backend source to /api..."
  # Sync backend/ to remote api/ folder, excluding vendor dependencies and local logs/caches
  rsync -avz -e "$RSYNC_SSH" \
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
else
  echo ">>> Skipping code compilation and deployment steps."
fi

# 2. Run migrations
if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo ">>> Running server-side database migrations..."
  if [ "$DEPLOY_CODE" = "true" ]; then
    # Full update includes Composer packages install
    $SSH "cd $REMOTE_DIR/api && composer install --no-dev --optimize-autoloader && php vendor/bin/phinx migrate"
  else
    # Migrations-only skips Composer installation
    $SSH "cd $REMOTE_DIR/api && php vendor/bin/phinx migrate"
  fi
else
  echo ">>> Skipping database migrations."
fi

echo "=================================================="
echo "✓ Action Completed Successfully!"
echo "=================================================="
