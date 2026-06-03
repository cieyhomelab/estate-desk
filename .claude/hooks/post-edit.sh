#!/usr/bin/env bash
# PostToolUse per-edit hook: lint + scoped unit tests on risk-area files.
# Exit 2 = blocking (agent sees stdout); exit 0 = pass.

INPUT=$(cat -)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)

[[ -z "$FILE" ]] && exit 0

case "$FILE" in
  *.ts|*.tsx|*.astro) ;;
  *) exit 0 ;;
esac

# Normalize to relative path from project root
REL_FILE="${FILE#$(pwd)/}"

# Lint (auto-fix; remaining errors are unfixable — agent must address them)
LINT_OUT=$(npx eslint "$REL_FILE" --fix 2>&1)
LINT_EXIT=$?
if [[ $LINT_EXIT -ne 0 ]]; then
  echo "ESLint errors in $REL_FILE:" >&2
  echo "$LINT_OUT" >&2
  exit 2
fi

# Scoped unit tests for risk-area source files (skip integration — needs live DB)
case "$REL_FILE" in
  src/integration/*) ;;
  src/*)
    TEST_OUT=$(npx vitest related "$REL_FILE" --run --config vitest.config.ts 2>&1)
    TEST_EXIT=$?
    if [[ $TEST_EXIT -ne 0 ]]; then
      echo "Unit test failures for $REL_FILE:" >&2
      echo "$TEST_OUT" >&2
      exit 2
    fi
    ;;
esac

exit 0
