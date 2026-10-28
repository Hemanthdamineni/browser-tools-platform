# Shared Install Strategy for Git Worktrees

## Problem
Running multiple git worktrees in parallel causes:
- Each worktree gets its own `node_modules` (~1 GB each)
- Disk space exhaustion on shared volumes
- Hardlink conflicts when adding dependencies in one worktree breaks others
- Slow install times for each new worktree

## Solution: Shared node_modules via Symlink

### Setup
```bash
# From main repo root
./scripts/worktree-setup.sh <branch-name> [base-branch]
```

This creates a worktree at `../worktrees/<branch-name>` and symlinks `node_modules` from the main repo.

### How it Works
1. Main repo (`/path/to/repo`) runs `npm install` once
2. Each worktree symlinks `node_modules` → `../../repo/node_modules`
3. All worktrees share the same installed dependencies
4. When `package.json` changes in a worktree, run `npm install` locally there

### Directory Structure
```
/path/to/
  repo/                    # Main checkout
    node_modules/          # Single shared install
    package.json
    package-lock.json
  worktrees/
    feature-foo/
      node_modules -> ../../repo/node_modules
      package.json
      package-lock.json
    feature-bar/
      node_modules -> ../../repo/node_modules
      package.json
      package-lock.json
```

### Adding Dependencies
When a worktree needs a new dependency:
```bash
cd ../worktrees/feature-foo
npm install new-package
# This updates the shared node_modules
```

### Updating Dependencies
When main repo updates deps:
```bash
cd /path/to/repo
npm install
# All worktrees see the updates automatically
```

### Cleanup
```bash
# Remove worktree
git worktree remove ../worktrees/feature-foo

# Prune stale worktree entries
git worktree prune
```

### CI Integration
For CI that uses worktrees:
```yaml
# .github/workflows/ci.yml
- name: Setup worktree
  run: ./scripts/worktree-setup.sh ${{ github.head_ref }} ${{ github.base_ref }}

- name: Install deps
  run: |
    cd ../worktrees/${{ github.head_ref }}
    npm ci
```

### Benefits
- **Disk space**: ~1 GB total vs N GB
- **Speed**: New worktree ready in seconds
- **Consistency**: All worktrees use exact same deps
- **No conflicts**: No hardlink issues
- **CI friendly**: Works with any CI system

### Caveats
- All worktrees must be compatible with the same Node.js version
- `package-lock.json` in worktree should match main (use `npm ci` in CI)
- If main repo dep update breaks a worktree, fix it in the worktree's package.json