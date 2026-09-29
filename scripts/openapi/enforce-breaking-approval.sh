#!/usr/bin/env bash

set -euo pipefail

readonly REQUIRED_LABEL='api-breaking-change-approved'
readonly REPORT_FILE="${CONTRACT_REPORT:-}"

if [[ -n "${REPORT_FILE}" && -f "${REPORT_FILE}" && -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "${REPORT_FILE}" >>"${GITHUB_STEP_SUMMARY}"
fi

if [[ "${BREAKING_CHANGES:-false}" != 'true' ]]; then
  printf 'No breaking API changes require approval.\n'
  exit 0
fi

if [[ "${APPROVAL_LABEL_PRESENT:-false}" != 'true' ]]; then
  printf '::error::Breaking API changes require the %s label.\n' \
    "${REQUIRED_LABEL}" >&2
  exit 1
fi

for command_name in gh jq; do
  command -v "${command_name}" >/dev/null 2>&1 || {
    printf '::error::Required approval command is unavailable: %s\n' \
      "${command_name}" >&2
    exit 2
  }
done

[[ -n "${GH_TOKEN:-}" && -n "${GITHUB_REPOSITORY:-}" && -n "${PR_NUMBER:-}" ]] || {
  printf '::error::GitHub approval context is incomplete.\n' >&2
  exit 2
}

review_data="$(
  gh pr view "${PR_NUMBER}" \
    --repo "${GITHUB_REPOSITORY}" \
    --json commits,reviewDecision,reviews
)"
latest_commit_oid="$(jq -r '.commits[-1].oid // empty' <<<"${review_data}")"

[[ -n "${latest_commit_oid}" ]] || {
  printf '::error::Unable to determine the latest pull-request commit.\n' >&2
  exit 2
}

if ! jq -e --arg latest_commit_oid "${latest_commit_oid}" '
  .reviewDecision == "APPROVED" and
  any(
    .reviews[]?;
    .state == "APPROVED" and .commit.oid == $latest_commit_oid
  )
' <<<"${review_data}" >/dev/null; then
  printf '%s\n' \
    '::error::Breaking API changes require a current approving decision on the latest commit.' \
    >&2
  exit 1
fi

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  printf '\n> Breaking changes were explicitly approved with `%s` and a review of the latest commit.\n' \
    "${REQUIRED_LABEL}" >>"${GITHUB_STEP_SUMMARY}"
fi

printf 'Breaking API changes have a current, auditable approval.\n'
