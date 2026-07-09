#!/usr/bin/env bash

# Main Orchestrator for Antigravity Builder
# Integrates fetching issues, running the agent, managing git flow, and deploying.

set -euo pipefail

# Find script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Settings defaults
DRY_RUN=false
BASE_BRANCH="${BASE_BRANCH:-main}"
LABEL="${ISSUE_LABEL:-antigravity}"

# Parse command line options
for arg in "$@"; do
  case "$arg" in
    --dry-run|-d)
      DRY_RUN=true
      shift
      ;;
    *)
      ;;
  esac
done

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
  echo " RUNNING IN DRY-RUN MODE (No actions taken) "
  echo "============================================="
  # Set dummy env vars for dry-run
  export GITHUB_PAT="mock_pat"
  export GITHUB_REPOSITORY="mock/repo"
fi

# 1. Fetch Issues
echo "Fetching issues..."
if [ "$DRY_RUN" = "true" ]; then
  ISSUES='[
    {
      "number": 42,
      "title": "Fix bug in calculation logic",
      "body": "The calculation logic should use correct rounding to 2 decimal places."
    },
    {
      "number": 43,
      "title": "Add README instructions",
      "body": "Add instructions on how to run the new builder scripts to README.md."
    }
  ]'
else
  # Execute the fetch_issues script and capture output
  ISSUES=$("$SCRIPT_DIR/fetch_issues.sh")
fi

# Check if there was an empty array or no issues found
LEN=$(echo "$ISSUES" | jq '. | length')
if [ "$LEN" -eq 0 ]; then
  echo "No open issues found with label '$LABEL'."
  exit 0
fi

echo "Found $LEN issue(s) to process."

# 2. Iterate through each issue
for ((i=0; i<LEN; i++)); do
  ISSUE_NUMBER=$(echo "$ISSUES" | jq -r ".[$i].number")
  ISSUE_TITLE=$(echo "$ISSUES" | jq -r ".[$i].title")
  ISSUE_BODY=$(echo "$ISSUES" | jq -r ".[$i].body")

  echo ""
  echo "--------------------------------------------------"
  echo "Processing Issue #$ISSUE_NUMBER: $ISSUE_TITLE"
  echo "--------------------------------------------------"

  if [ "$DRY_RUN" = "true" ]; then
    echo "[DRY RUN] Would checkout base branch '$BASE_BRANCH'"
    echo "[DRY RUN] Would create and checkout branch 'issue-$ISSUE_NUMBER'"
    echo "[DRY RUN] Would invoke: agy --dangerously-skip-permissions --print \"[Prompt for Issue #$ISSUE_NUMBER]\""
    echo "[DRY RUN] Would check git status for changes"
    echo "[DRY RUN] Would commit changes, push branch 'issue-$ISSUE_NUMBER', and create Pull Request"
    echo "[DRY RUN] Would remove label '$LABEL' from issue #$ISSUE_NUMBER"
    echo "[DRY RUN] Would run deploy script"
    continue
  fi

  # Checkout base and pull latest changes
  (cd "$PROJECT_ROOT" && "$SCRIPT_DIR/git_manager.sh" checkout_base)

  # Create and checkout a branch for the issue
  (cd "$PROJECT_ROOT" && "$SCRIPT_DIR/git_manager.sh" create_branch "$ISSUE_NUMBER")

  # Run the agent on the issue
  set +e
  "$SCRIPT_DIR/run_agent.sh" "$ISSUE_NUMBER" "$ISSUE_TITLE" "$ISSUE_BODY"
  AGENT_STATUS=$?
  set -e

  if [ $AGENT_STATUS -ne 0 ]; then
    echo "Warning: Antigravity agent encountered an error (exit code $AGENT_STATUS) while processing issue #$ISSUE_NUMBER." >&2
    # Continue to next issue or return to base branch
    (cd "$PROJECT_ROOT" && "$SCRIPT_DIR/git_manager.sh" checkout_base)
    continue
  fi

  # Check if files were modified
  set +e
  (cd "$PROJECT_ROOT" && "$SCRIPT_DIR/git_manager.sh" check_changes)
  CHANGES_EXIST=$?
  set -e

  if [ $CHANGES_EXIST -eq 0 ]; then
    echo "Changes detected! Committing and pushing..."
    (cd "$PROJECT_ROOT" && "$SCRIPT_DIR/git_manager.sh" commit_and_push "$ISSUE_NUMBER" "$ISSUE_TITLE")

    echo "Creating Pull Request..."
    (cd "$PROJECT_ROOT" && "$SCRIPT_DIR/git_manager.sh" create_pr "$ISSUE_NUMBER" "$ISSUE_TITLE")

    echo "Removing '$LABEL' label from issue..."
    (cd "$PROJECT_ROOT" && "$SCRIPT_DIR/git_manager.sh" remove_label "$ISSUE_NUMBER")

    # Run deployment tasks
    (cd "$PROJECT_ROOT" && "$SCRIPT_DIR/deploy.sh")
  else
    echo "No modifications detected for issue #$ISSUE_NUMBER. Skipping PR creation."
    # Optionally remove the label anyway so we don't repeat the loop
    (cd "$PROJECT_ROOT" && "$SCRIPT_DIR/git_manager.sh" remove_label "$ISSUE_NUMBER")
  fi

  # Return to base branch before next iteration
  (cd "$PROJECT_ROOT" && "$SCRIPT_DIR/git_manager.sh" checkout_base)
done

echo ""
echo "Automation run completed successfully."
