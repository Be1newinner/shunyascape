#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "🔒 Setting up local Git hooks for ShunyaScape..."

# Locate the root .git directory
GIT_DIR=$(git rev-parse --git-dir 2>/dev/null)

if [ -z "$GIT_DIR" ]; then
  echo "❌ Error: Not a git repository. Make sure you are running this from the repository root."
  exit 1
fi

HOOKS_DIR="$GIT_DIR/hooks"
PRE_PUSH_HOOK="$HOOKS_DIR/pre-push"

# Ensure hooks directory exists
mkdir -p "$HOOKS_DIR"

# Write the pre-push hook content
cat << 'EOF' > "$PRE_PUSH_HOOK"
#!/bin/sh

# Prevent accidental direct pushes to the main branch
# Git sends reference updates to stdin in the form: <local ref> <local sha1> <remote ref> <remote sha1>

PROTECTED_BRANCH="refs/heads/main"
BLOCKED_PUSH=0

while read local_ref local_sha remote_ref remote_sha
do
    if [ "$remote_ref" = "$PROTECTED_BRANCH" ]; then
        BLOCKED_PUSH=1
    fi
done

if [ "$BLOCKED_PUSH" -eq 1 ]; then
    echo ""
    echo "========================================================================"
    echo "❌ ERROR: Push blocked! You are attempting to push directly to 'main'."
    echo "========================================================================"
    echo "Direct pushes to the main branch are disabled to prevent accidental breaks."
    echo "Please use the following workflow to contribute:"
    echo "  1. Create a feature branch: git checkout -b feature/your-feature-name"
    echo "  2. Commit and push your feature branch: git push origin feature/your-feature-name"
    echo "  3. Open a Pull Request (PR) on GitHub to merge into main."
    echo "========================================================================"
    echo ""
    exit 1
fi

exit 0
EOF

# Make the hook executable
chmod +x "$PRE_PUSH_HOOK"

echo "✅ Git pre-push hook successfully installed at: $PRE_PUSH_HOOK"
echo "👉 Accidental direct pushes to 'main' will now be blocked locally."
