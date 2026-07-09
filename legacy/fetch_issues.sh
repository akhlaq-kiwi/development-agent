#!/usr/bin/env bash

# Fetch issues module for Antigravity Builder
# Fetches open issues from the repository filtering by label, excluding PRs.

set -euo pipefail

# Verify required variables
if [ -z "${GITHUB_PAT:-}" ]; then
  echo "Error: GITHUB_PAT environment variable is not set." >&2
  exit 1
fi

if [ -z "${GITHUB_REPOSITORY:-}" ]; then
  echo "Error: GITHUB_REPOSITORY environment variable is not set." >&2
  exit 1
fi

LABEL="${ISSUE_LABEL:-antigravity}"

# Normalize GITHUB_REPOSITORY to owner/repo format
CLEAN_REPO="${GITHUB_REPOSITORY}"
CLEAN_REPO="${CLEAN_REPO#http://github.com/}"
CLEAN_REPO="${CLEAN_REPO#https://github.com/}"
CLEAN_REPO="${CLEAN_REPO%.git}"

echo "Fetching open issues labeled with '$LABEL' from $CLEAN_REPO..." >&2

# Fetch issues from GitHub API
RESPONSE=$(curl -s -f \
  -H "Authorization: token $GITHUB_PAT" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/$CLEAN_REPO/issues?state=open&labels=$LABEL&per_page=100&sort=created&direction=asc")

# Filter issues to exclude Pull Requests and format as JSON array
# GitHub API represents PRs as issues too, but they have a 'pull_request' field.
FILTERED_ISSUES=$(echo "$RESPONSE" | jq '[.[] | select(.pull_request == null) | {number: .number, title: .title, body: .body}]')

echo "$FILTERED_ISSUES"
