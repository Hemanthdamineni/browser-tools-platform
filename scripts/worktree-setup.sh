#!/usr/bin/env bash
# worktree-setup.sh - Setup script for git worktrees with shared node_modules
# Usage: ./scripts/worktree-setup.sh <branch-name> [base-branch]

set -euo pipefail

REPO_ROOT=$(git rev-parse --show-toplevel)
BRANCH_NAME="${1:-feature-$(date +%s)}"
BASE_BRANCH="${2:-master}"

WORKTREE_DIR="${REPO_ROOT}/../worktrees/${BRANCH_NAME}"

echo "Setting up worktree for branch: ${BRANCH_NAME} (base: ${BASE_BRANCH})"
echo "Worktree location: ${WORKTREE_DIR}"

# Create worktree
cd "${REPO_ROOT}"
git worktree add "${WORKTREE_DIR}" -b "${BRANCH_NAME}" "${BASE_BRANCH}"

# Create shared node_modules symlink
echo "Setting up shared node_modules..."
cd "${WORKTREE_DIR}"

if [[ -d "${REPO_ROOT}/node_modules" ]]; then
  ln -sf "${REPO_ROOT}/node_modules" .
  echo "Linked shared node_modules from ${REPO_ROOT}/node_modules"
else
  echo "Warning: No node_modules found in main repo. Run 'npm install' in main repo first."
fi

# Install dependencies if package.json changed
if git diff --name-only "${BASE_BRANCH}"..HEAD | grep -q "package.json"; then
  echo "package.json changed, installing dependencies..."
  npm install
else
  echo "package.json unchanged, using shared node_modules"
fi

# Run any post-setup scripts
if [[ -f "scripts/post-worktree-setup.sh" ]]; then
  bash scripts/post-worktree-setup.sh
fi

echo "Worktree setup complete!"
echo "To start working: cd ${WORKTREE_DIR} && npm run dev"