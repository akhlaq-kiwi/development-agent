#!/usr/bin/env bash

# scheduler.sh - Antigravity Periodic Runner
# Runs the orchestrator loop periodically at a configured interval.

set -euo pipefail

# Find script directory (this will be /path/to/project/builder)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load environment variables from .env file if it exists (checking parent directory first, then builder folder)
if [ -f "$SCRIPT_DIR/../.env" ]; then
  ENV_PATH="$SCRIPT_DIR/../.env"
elif [ -f "$SCRIPT_DIR/.env" ]; then
  ENV_PATH="$SCRIPT_DIR/.env"
else
  ENV_PATH=""
fi

if [ -n "$ENV_PATH" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    # Strip carriage returns (for compatibility)
    line=$(echo "$line" | tr -d '\r')
    # Skip comments and empty lines
    if [[ "$line" =~ ^[[:space:]]*# ]] || [[ -z "$line" ]]; then
      continue
    fi
    # Only export valid KEY=VALUE pairs
    if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
      export "$line"
    fi
  done < "$ENV_PATH"
fi

# Settings defaults
POLL_INTERVAL="${POLL_INTERVAL:-300}" # Default to 5 minutes (300 seconds)

# Forward arguments to main_agent.sh
FORWARD_ARGS="$@"

# Graceful termination handler
cleanup() {
  echo ""
  echo "[$(date)] Stopping scheduler daemon..."
  exit 0
}
trap cleanup SIGINT SIGTERM

echo "============================================="
echo " Starting Antigravity Scheduler Daemon       "
echo " Polling Interval: $POLL_INTERVAL seconds     "
echo " Arguments: $FORWARD_ARGS                    "
echo "============================================="
echo "Press Ctrl+C to terminate the daemon cleanly."
echo ""

# Countdown timer function
countdown() {
  local seconds=$1
  while [ $seconds -gt 0 ]; do
    printf "\r[$(date +'%H:%M:%S')] Sleeping... %02d:%02d remaining " $((seconds / 60)) $((seconds % 60))
    sleep 1
    seconds=$((seconds - 1))
  done
  printf "\r[$(date +'%H:%M:%S')] Starting next run...                       \n"
}

while true; do
  echo "[$(date)] Running main_agent.sh..."
  
  # Run orchestrator in a subshell, forwarding dry-run/single settings
  # We do not fail the daemon if a single run cycle fails.
  set +e
  "$SCRIPT_DIR/main_agent.sh" $FORWARD_ARGS
  RUN_STATUS=$?
  set -e
  
  if [ $RUN_STATUS -ne 0 ]; then
    echo "[$(date)] Warning: main_agent.sh execution returned non-zero status ($RUN_STATUS)." >&2
  fi
  
  countdown "$POLL_INTERVAL"
  echo "---------------------------------------------"
done
