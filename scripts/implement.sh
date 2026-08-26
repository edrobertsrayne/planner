#!/usr/bin/env bash
set -euo pipefail

MODEL="${IMPLEMENT_MODEL:-opencode-go/minimax-m3}"
DONE_TOKEN="<promise>COMPLETE</promise>"
COUNT="${1:-5}"
PROMPT="Implement the first available issue with a ready-for-agent label then commit the code, close the issue, and stop.

When there are no open ready-for-agent issues remaining, output exactly:

${DONE_TOKEN}

on its own line, and no other output."

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
  if ! agent_output=$(opencode run -m "$MODEL" "$PROMPT"); then
    echo "warning: opencode exited non-zero for iteration $i, continuing..." >&2
    FAILED+=("$i")
    continue
  fi
  echo "$agent_output"
  if grep -qx "${DONE_TOKEN}" <<<"$agent_output"; then
    echo "Queue complete after $i iteration(s)."
    exit 0
  fi
done

echo ""
if [[ ${#FAILED[@]} -gt 0 ]]; then
  echo "Done with failures: iterations ${FAILED[*]}"
  exit 1
fi
echo "Done. Ran $COUNT iteration(s)."
