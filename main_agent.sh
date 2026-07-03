#!/usr/bin/env bash

# Antigravity Orchestrator - main_agent.sh
# Handles issue processing, requirements file transitions, git management, and deployment.

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
  echo "Loading environment variables from $ENV_PATH..." >&2
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

# Define project target directory (defaulting to the parent folder of the builder directory)
export PROJECT_DIR="${PROJECT_DIR:-$(dirname "$SCRIPT_DIR")}"

# Directory paths
REQ_OPEN="$PROJECT_DIR/requirements/open"
REQ_IN_PROGRESS="$PROJECT_DIR/requirements/In_progress"
REQ_DONE="$PROJECT_DIR/requirements/done"

# Ensure directories exist
mkdir -p "$REQ_OPEN" "$REQ_IN_PROGRESS" "$REQ_DONE"

# Settings defaults
DRY_RUN=false
BASE_BRANCH="${BASE_BRANCH:-main}"
LABEL="${ISSUE_LABEL:-antigravity}"

SINGLE_RUN=false

# Parse command line options
for arg in "$@"; do
  case "$arg" in
    --dry-run|-d)
      DRY_RUN=true
      shift
      ;;
    --single|-s)
      SINGLE_RUN=true
      shift
      ;;
    *)
      ;;
  esac
done
# 0. Initialize Git and remote origin if not already set up
if [ "$DRY_RUN" = "true" ]; then
  if [ ! -d "$PROJECT_DIR/.git" ]; then
    echo "[DRY RUN] Would initialize Git repository in $PROJECT_DIR"
  fi
  if ! (cd "$PROJECT_DIR" 2>/dev/null && git remote | grep -q "^origin$") 2>/dev/null; then
    echo "[DRY RUN] Would configure remote origin with PAT authentication"
  fi
else
  # Ensure target directory is initialized
  if [ ! -d "$PROJECT_DIR/.git" ]; then
    echo "Target project directory is not a Git repository. Initializing Git..." >&2
    (
      cd "$PROJECT_DIR"
      git init
      git checkout -b "$BASE_BRANCH" 2>/dev/null || git switch -c "$BASE_BRANCH" 2>/dev/null || true
    )
  fi

  # Configure remote origin with PAT if missing
  if ! (cd "$PROJECT_DIR" && git remote | grep -q "^origin$"); then
    echo "Configuring remote origin with PAT authentication..." >&2
    CLEAN_REPO="${GITHUB_REPOSITORY}"
    CLEAN_REPO="${CLEAN_REPO#http://github.com/}"
    CLEAN_REPO="${CLEAN_REPO#https://github.com/}"
    CLEAN_REPO="${CLEAN_REPO%.git}"
    REMOTE_URL="https://${GITHUB_PAT}@github.com/${CLEAN_REPO}.git"
    (
      cd "$PROJECT_DIR"
      git remote add origin "$REMOTE_URL"
    )
  fi

  # Bootstrap an initial commit if the repository is completely empty
  if [ -z "$(cd "$PROJECT_DIR" && git log --oneline 2>/dev/null)" ]; then
    echo "Repository is empty. Bootstrapping initial commit..." >&2
    (
      cd "$PROJECT_DIR"
      echo "# Project" > README.md
      git add README.md
      git commit -m "Initial commit"
    )
  fi
fi

# Verify environment variables (only if not dry run)
if [ "$DRY_RUN" = "false" ]; then
  if [ -z "${GITHUB_PAT:-}" ] || [ -z "${GITHUB_REPOSITORY:-}" ]; then
    echo "Error: GITHUB_PAT and GITHUB_REPOSITORY must be set in the environment." >&2
    echo "Usage: GITHUB_PAT=xxx GITHUB_REPOSITORY=owner/repo $0 [--dry-run]" >&2
    exit 1
  fi
fi

# Dry run mock setup
if [ "$DRY_RUN" = "true" ]; then
  echo "============================================="
  echo " RUNNING IN DRY-RUN MODE (No actions taken)  "
  echo "============================================="
  # Set dummy env vars for dry-run
  export GITHUB_PAT="mock_pat"
  export GITHUB_REPOSITORY="mock/repo"
fi

# Check if any issue is already in progress (skip check in dry-run mode)
if [ "$DRY_RUN" = "false" ] && [ "$(ls -A "$REQ_IN_PROGRESS" 2>/dev/null)" ]; then
  echo "An issue is already in progress in $REQ_IN_PROGRESS." >&2
  echo "Please complete the current issue and clean up before starting a new one." >&2
  exit 0
fi

# 1. Fetch Issues
echo "Fetching issues..."
if [ "$DRY_RUN" = "true" ]; then
  ISSUES='[
    {
      "number": 101,
      "title": "Implement feature X",
      "body": "This feature requires adding a new module X."
    },
    {
      "number": 102,
      "title": "Fix bug Y",
      "body": "Bug Y causes incorrect output in module Z."
    }
  ]'
else
  # Call fetch_issues.sh (same directory)
  ISSUES=$("$SCRIPT_DIR/fetch_issues.sh")
fi

LEN=$(echo "$ISSUES" | jq '. | length')
if [ "$LEN" -eq 0 ]; then
  echo "No open issues found with label '$LABEL'."
  exit 0
fi

echo "Found $LEN issue(s) to process."

# 2. Process issues
PROCESSED_ANY=false

for ((i=0; i<LEN; i++)); do
  ISSUE_NUMBER=$(echo "$ISSUES" | jq -r ".[$i].number")
  ISSUE_TITLE=$(echo "$ISSUES" | jq -r ".[$i].title")
  ISSUE_BODY=$(echo "$ISSUES" | jq -r ".[$i].body")

  echo ""
  echo "--------------------------------------------------"
  echo "Processing Issue #$ISSUE_NUMBER: $ISSUE_TITLE"
  echo "--------------------------------------------------"

  # Skip if already done
  if [ -f "$REQ_DONE/issue-$ISSUE_NUMBER.md" ]; then
    echo "Issue #$ISSUE_NUMBER is already marked as done. Skipping."
    continue
  fi

  PROCESSED_ANY=true

  # Create markdown requirement file if not already present
  REQ_FILE="issue-$ISSUE_NUMBER.md"
  if [ ! -f "$REQ_OPEN/$REQ_FILE" ] && [ ! -f "$REQ_IN_PROGRESS/$REQ_FILE" ]; then
    echo "Writing requirements file to $REQ_OPEN/$REQ_FILE..."
    cat <<EOF > "$REQ_OPEN/$REQ_FILE"
# Issue #$ISSUE_NUMBER: $ISSUE_TITLE

## Description
$ISSUE_BODY
EOF
  fi

  if [ "$DRY_RUN" = "true" ]; then
    echo "[DRY RUN] Would checkout base branch '$BASE_BRANCH'"
    echo "[DRY RUN] Would create and checkout branch 'issue-$ISSUE_NUMBER'"
    echo "[DRY RUN] Transition: Moving $REQ_OPEN/$REQ_FILE to $REQ_IN_PROGRESS/$REQ_FILE"
    mv "$REQ_OPEN/$REQ_FILE" "$REQ_IN_PROGRESS/$REQ_FILE"
    
    echo "[DRY RUN] Would invoke: $SCRIPT_DIR/run_agent.sh \"$ISSUE_NUMBER\" \"$ISSUE_TITLE\" ..."
    echo "[DRY RUN] Transition: Moving $REQ_IN_PROGRESS/$REQ_FILE to $REQ_DONE/$REQ_FILE"
    mv "$REQ_IN_PROGRESS/$REQ_FILE" "$REQ_DONE/$REQ_FILE"
    
    echo "[DRY RUN] Would commit changes, push, create PR, and remove label"
    echo "[DRY RUN] Would run deploy script"
    
    if [ "$SINGLE_RUN" = "true" ] && [ "$PROCESSED_ANY" = "true" ]; then
      echo "Single issue limit reached. Exiting."
      break
    fi
    continue
  fi

  # Checkout base and pull latest changes
  "$SCRIPT_DIR/git_manager.sh" checkout_base

  # Create and checkout a branch for the issue
  "$SCRIPT_DIR/git_manager.sh" create_branch "$ISSUE_NUMBER"

  # Move requirement file to "In_progress" state
  if [ -f "$REQ_OPEN/$REQ_FILE" ]; then
    echo "Transitioning requirement file to In_progress..."
    mv "$REQ_OPEN/$REQ_FILE" "$REQ_IN_PROGRESS/$REQ_FILE"
    
    # We run git commands inside PROJECT_DIR
    (
      cd "$PROJECT_DIR"
      # Stage this change immediately so it is tracked in this branch
      git add "$REQ_IN_PROGRESS/$REQ_FILE"
      # Also clean up the deletion in open folder
      git rm -f "$REQ_OPEN/$REQ_FILE" 2>/dev/null || true
    )
  fi

  # Run the agent on the issue
  set +e
  "$SCRIPT_DIR/run_agent.sh" "$ISSUE_NUMBER" "$ISSUE_TITLE" "$ISSUE_BODY"
  AGENT_STATUS=$?
  set -e

  if [ $AGENT_STATUS -ne 0 ]; then
    echo "Warning: Agent failed (exit code $AGENT_STATUS) on issue #$ISSUE_NUMBER. Reverting state..." >&2
    # Move back to open
    if [ -f "$REQ_IN_PROGRESS/$REQ_FILE" ]; then
      mv "$REQ_IN_PROGRESS/$REQ_FILE" "$REQ_OPEN/$REQ_FILE"
    fi
    # Return to base branch
    "$SCRIPT_DIR/git_manager.sh" checkout_base
    continue
  fi

  # Check if changes were made (either code or requirement file movement)
  set +e
  "$SCRIPT_DIR/git_manager.sh" check_changes
  CHANGES_EXIST=$?
  set -e

  # Note: moving requirement file to done
  if [ -f "$REQ_IN_PROGRESS/$REQ_FILE" ]; then
    echo "Transitioning requirement file to done..."
    mv "$REQ_IN_PROGRESS/$REQ_FILE" "$REQ_DONE/$REQ_FILE"
    (
      cd "$PROJECT_DIR"
      git add "$REQ_DONE/$REQ_FILE"
      git rm -f "$REQ_IN_PROGRESS/$REQ_FILE" 2>/dev/null || true
    )
    # Since we moved the file, changes definitely exist now
    CHANGES_EXIST=0
  fi

  if [ $CHANGES_EXIST -eq 0 ]; then
    echo "Changes detected! Committing and pushing..."
    "$SCRIPT_DIR/git_manager.sh" commit_and_push "$ISSUE_NUMBER" "$ISSUE_TITLE"

    echo "Creating Pull Request..."
    "$SCRIPT_DIR/git_manager.sh" create_pr "$ISSUE_NUMBER" "$ISSUE_TITLE"

    echo "Removing '$LABEL' label from issue..."
    "$SCRIPT_DIR/git_manager.sh" remove_label "$ISSUE_NUMBER"

    # Run deployment tasks
    "$SCRIPT_DIR/deploy.sh"
  else
    echo "No modifications detected for issue #$ISSUE_NUMBER. Reverting requirement state..."
    if [ -f "$REQ_DONE/$REQ_FILE" ]; then
      mv "$REQ_DONE/$REQ_FILE" "$REQ_OPEN/$REQ_FILE"
    fi
    "$SCRIPT_DIR/git_manager.sh" remove_label "$ISSUE_NUMBER"
  fi

  # Return to base branch before next iteration
  "$SCRIPT_DIR/git_manager.sh" checkout_base

  if [ "$SINGLE_RUN" = "true" ] && [ "$PROCESSED_ANY" = "true" ]; then
    echo "Single issue limit reached. Exiting."
    break
  fi
done

echo ""
echo "Automation run completed successfully."
