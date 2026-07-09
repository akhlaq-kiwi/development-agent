#!/usr/bin/env bash

# Run agent module for Antigravity Builder
# Spawns the antigravity agent (agy) to resolve a given issue.

set -euo pipefail

# Check for correct arguments
if [ "$#" -lt 3 ]; then
  echo "Usage: $0 <issue_number> <issue_title> <issue_body> [verify_errors]" >&2
  exit 1
fi

ISSUE_NUMBER="$1"
ISSUE_TITLE="$2"
ISSUE_BODY="$3"
VERIFY_ERRORS="${4:-}"

echo "==================================================" >&2
echo "Running Antigravity Agent for Issue #$ISSUE_NUMBER: $ISSUE_TITLE" >&2
echo "==================================================" >&2

# Navigate to the workspace root directory (parent of builder)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="${PROJECT_DIR:-$(dirname "$SCRIPT_DIR")}"

# Fetch compact project context
CONTEXT=""
if [ -f "$SCRIPT_DIR/generate_context.sh" ]; then
  echo "Gathering project context..." >&2
  CONTEXT=$("$SCRIPT_DIR/generate_context.sh")
fi

# Construct the prompt for agy
PROMPT="Resolve the GitHub Issue #$ISSUE_NUMBER.

Title: $ISSUE_TITLE

Description:
$ISSUE_BODY"

if [ -n "$CONTEXT" ]; then
  PROMPT="$PROMPT

Compact Codebase Context:
$CONTEXT"
fi

if [ -n "$VERIFY_ERRORS" ]; then
  PROMPT="$PROMPT

ATTENTION: A previous attempt to compile the project or run tests failed with the following errors. You MUST resolve these issues:

$VERIFY_ERRORS"
fi

PROMPT="$PROMPT

Instructions:
1. Understand the issue and identify the files that need to be changed or created.
2. CRITICAL: You must implement all changes and write all new files directly inside the current working directory (the project workspace). Do not create or use folders outside of this project directory.
3. Clean up any temporary files you created during the process."

# Execute the antigravity CLI from the workspace root
# We use --dangerously-skip-permissions to allow the agent to run automatically without prompting.
(
  cd "$WORKSPACE_ROOT"
  agy --dangerously-skip-permissions --add-dir "$WORKSPACE_ROOT" --print-timeout "${AGENT_TIMEOUT:-20m}" --print "$PROMPT"
)
