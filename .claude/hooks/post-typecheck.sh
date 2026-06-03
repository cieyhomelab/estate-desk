#!/usr/bin/env bash
# PostToolUse per-edit hook: TypeScript type check after each .ts/.tsx edit.
# Exit 2 = blocking (agent sees stdout); exit 0 = pass.
# .astro files are NOT included — tsc cannot parse them; astro check runs at pre-commit.

INPUT=$(cat -)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)

[[ -z "$FILE" ]] && exit 0

case "$FILE" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac

TSC_OUT=$(npx tsc --noEmit --skipLibCheck 2>&1)
TSC_EXIT=$?
if [[ $TSC_EXIT -ne 0 ]]; then
  echo "TypeScript errors:" >&2
  echo "$TSC_OUT" >&2
  exit 2
fi

exit 0
