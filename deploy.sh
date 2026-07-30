#!/bin/bash
# deploy.sh — one command to push this site to GitHub.
#
# Usage:
#   ./deploy.sh "Your commit message here"
#   ./deploy.sh                              (uses a timestamped default message)
#
# This script is safe to run repeatedly. It automatically:
#   - Confirms it's running from the correct folder
#   - Initializes git if this is a fresh unzip that's never been pushed
#   - Connects the GitHub remote if it's missing
#   - Fixes the remote URL if it's pointing somewhere else
#   - Stages, commits, and force-pushes everything to main

set -e  # stop immediately if any step fails, instead of continuing with a half-done push

REPO_URL="https://github.com/brkadiyala-pixel/florida-new-homes.git"
COMMIT_MSG="${1:-Update site $(date '+%Y-%m-%d %H:%M')}"

# --- Step 1: confirm we're in the right folder ---
if [ ! -f "_worker.js" ] || [ ! -d "public" ]; then
  echo "❌ This doesn't look like the project folder (no _worker.js or public/ found here)."
  echo "   Current directory: $(pwd)"
  echo "   cd into the unzipped 'luxury-redefined-palmbeach' folder and try again."
  exit 1
fi
echo "✅ Confirmed project folder: $(pwd)"

# --- Step 2: set up git if this is a fresh copy ---
if [ ! -d ".git" ]; then
  echo "→ No git repo here yet — initializing..."
  git init
  git branch -M main
fi

# --- Step 3: make sure the remote points to the right place ---
if git remote get-url origin >/dev/null 2>&1; then
  CURRENT_URL="$(git remote get-url origin)"
  if [ "$CURRENT_URL" != "$REPO_URL" ]; then
    echo "→ Fixing remote URL (was pointing elsewhere)..."
    git remote set-url origin "$REPO_URL"
  fi
else
  echo "→ Adding GitHub remote..."
  git remote add origin "$REPO_URL"
fi

# --- Step 4: stage, commit, push ---
git add -A

if git diff --cached --quiet; then
  echo "ℹ️  Nothing changed since the last push — nothing to commit."
else
  git commit -m "$COMMIT_MSG"
  echo "✅ Committed: $COMMIT_MSG"
fi

echo "→ Pushing to GitHub..."
git push -u origin main --force

echo ""
echo "✅ Done! Pushed to https://github.com/brkadiyala-pixel/florida-new-homes"
echo "   Check Cloudflare's Deployments tab for the new build."
