#!/bin/bash
set -uo pipefail

# Stop hook: when Claude finishes a turn, if any TypeScript files changed in the
# working tree, run the project's typecheck so type errors surface locally before
# the work is reported as done, mirroring the CI gate. Fast and advisory: with no
# TS changes it exits instantly and does nothing.

# Loop protection: if this stop was itself triggered by a prior run of this hook,
# don't re-block, or Claude could get stuck unable to finish.
input=$(cat 2>/dev/null || true)
if printf '%s' "$input" | grep -q '"stop_hook_active":[[:space:]]*true'; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

# Only bother when TS/TSX files are actually dirty.
changed=$(git status --porcelain -- '*.ts' '*.tsx' 2>/dev/null)
[ -z "$changed" ] && exit 0

# Need the compiler present to check anything.
[ -d node_modules/typescript ] || exit 0

out=$(npx tsc --noEmit 2>&1)
if [ $? -ne 0 ]; then
  {
    echo "Typecheck failed (npx tsc --noEmit) with TS changes in the tree. Fix before finishing:"
    printf '%s\n' "$out" | head -40
  } >&2
  exit 2
fi

exit 0
