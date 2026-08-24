#!/usr/bin/env bash
set -euo pipefail

MODEL="${IMPLEMENT_MODEL:-opencode-go/ox-alpha-free}"
COUNT="${1:-5}"
PROMPT="Implement the next available issue with a ready-for-agent label then commit the code and close the issue."

if ! [[ "$COUNT" =~ ^[0-9]+$ ]] || [[ "$COUNT" -eq 0 ]]; then
  echo "error: argument must be a positive integer (got '$COUNT')" >&2
  echo "usage: implement.sh [count]" >&2
  exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

FAILED=()
for ((i = 1; i <= COUNT; i++)); do
  echo ""
  echo "=== Iteration $i of $COUNT ==="
  if ! opencode run -m "$MODEL" "$PROMPT"; then
    echo "warning: opencode exited non-zero for iteration $i, continuing..." >&2
    FAILED+=("$i")
  fi
done

echo ""
if [[ ${#FAILED[@]} -gt 0 ]]; then
  echo "Done with failures: iterations ${FAILED[*]}"
  exit 1
fi
echo "Done. Ran $COUNT iteration(s)."
