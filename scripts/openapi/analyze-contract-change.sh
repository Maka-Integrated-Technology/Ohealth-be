#!/usr/bin/env bash

set -euo pipefail

readonly BASE_CONTRACT="${1:-}"
readonly REVISION_CONTRACT="${2:-}"
readonly REPORT_FILE="${3:-}"
readonly OASDIFF_BIN="${OASDIFF_BIN:-oasdiff}"
readonly TEMP_DIR="$(mktemp -d)"

trap 'rm -rf "${TEMP_DIR}"' EXIT

if [[ -z "${BASE_CONTRACT}" || -z "${REVISION_CONTRACT}" || -z "${REPORT_FILE}" ]]; then
  printf 'Usage: %s <base-contract> <revision-contract> <report-file>\n' "$0" >&2
  exit 2
fi

command -v "${OASDIFF_BIN}" >/dev/null 2>&1 || {
  printf 'Required command is unavailable: %s\n' "${OASDIFF_BIN}" >&2
  exit 2
}

"${OASDIFF_BIN}" changelog \
  "${BASE_CONTRACT}" \
  "${REVISION_CONTRACT}" \
  --allow-external-refs=false \
  --format markdown >"${TEMP_DIR}/changelog.md"

breaking_exit=0
"${OASDIFF_BIN}" breaking \
  "${BASE_CONTRACT}" \
  "${REVISION_CONTRACT}" \
  --allow-external-refs=false \
  --fail-on WARN >"${TEMP_DIR}/breaking.txt" || breaking_exit=$?

case "${breaking_exit}" in
  0) breaking_changes='false' ;;
  1) breaking_changes='true' ;;
  *)
    printf 'oasdiff failed while comparing contracts with exit code %s\n' \
      "${breaking_exit}" >&2
    exit "${breaking_exit}"
    ;;
esac

{
  printf '## API Contract Compatibility Report\n\n'
  awk '
    NF {
      if ($0 ~ /^#+ /) $0 = "##" $0
      blank = 0
      print
      next
    }
    !blank { print; blank = 1 }
  ' "${TEMP_DIR}/changelog.md"
  printf '\n### Breaking-change assessment\n\n```text\n'
  cat "${TEMP_DIR}/breaking.txt"
  printf '\n```\n'
} >"${REPORT_FILE}"

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  printf 'breaking_changes=%s\n' "${breaking_changes}" >>"${GITHUB_OUTPUT}"
fi

printf 'API contract analysis completed; breaking_changes=%s\n' \
  "${breaking_changes}"
