#!/usr/bin/env bash
# PreToolUse hook (Bash matcher): block npm/npx commands, suggest the bun equivalent.
input=$(cat)
command=$(jq -r '.tool_input.command // empty' <<<"$input")

if [[ "$command" =~ (^|[;&|]\ *)(npm|npx)([^a-zA-Z0-9_-]|$) ]]; then
  suggestion=$(sed -E \
    -e 's/\bnpm run\b/bun run/g' \
    -e 's/\bnpm ci\b/bun install --frozen-lockfile/g' \
    -e 's/\bnpm install\b/bun install/g' \
    -e 's/\bnpm uninstall\b/bun remove/g' \
    -e 's/\bnpm test\b/bun test/g' \
    -e 's/\bnpx\b/bunx/g' \
    -e 's/\bnpm\b/bun/g' \
    <<<"$command")

  jq -n --arg reason "This project uses bun, not npm (see CLAUDE.md). Try: $suggestion" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $reason
    }
  }'
  exit 0
fi

exit 0
