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

pull_request_data="$(
  gh api "repos/${GITHUB_REPOSITORY}/pulls/${PR_NUMBER}"
)"
review_pages="$(
  gh api --paginate --slurp \
    "repos/${GITHUB_REPOSITORY}/pulls/${PR_NUMBER}/reviews?per_page=100"
)"
latest_commit_oid="$(jq -r '.head.sha // empty' <<<"${pull_request_data}")"

[[ -n "${latest_commit_oid}" ]] || {
  printf '::error::Unable to determine the latest pull-request commit.\n' >&2
  exit 2
}

event_review_is_current=false
if [[ "${EVENT_REVIEW_STATE:-}" == 'approved' &&
  "${EVENT_REVIEW_COMMIT_OID:-}" == "${latest_commit_oid}" ]]; then
  case "${EVENT_REVIEW_AUTHOR_ASSOCIATION:-}" in
    OWNER | MEMBER | COLLABORATOR)
      event_review_is_current=true
      ;;
  esac
fi

if [[ "${event_review_is_current}" != 'true' ]] && ! jq -e --arg latest_commit_oid "${latest_commit_oid}" '
  [
    .[][]? |
    (.author_association // "") as $association |
    select(
      (.user.login | type == "string" and length > 0) and
      (.submitted_at | type == "string" and length > 0) and
      (["OWNER", "MEMBER", "COLLABORATOR"] | index($association)) != null
    )
  ] |
  group_by(.user.login) |
  map(max_by(.submitted_at)) |
  any(
    .[];
    .state == "APPROVED" and .commit_id == $latest_commit_oid
  )
' <<<"${review_pages}" >/dev/null; then
  jq -c --arg latest_commit_oid "${latest_commit_oid}" '
    {
      latest_commit_oid: $latest_commit_oid,
      event_review: {
        state: $ENV.EVENT_REVIEW_STATE,
        author_association: $ENV.EVENT_REVIEW_AUTHOR_ASSOCIATION,
        commit_id: $ENV.EVENT_REVIEW_COMMIT_OID
      },
      trusted_reviews: [
        .[][]? |
        (.author_association // "") as $association |
        select(
          (["OWNER", "MEMBER", "COLLABORATOR"] |
            index($association)) != null
        ) |
        {
          reviewer: .user.login,
          state,
          submitted_at,
          commit_id
        }
      ]
    }
  ' <<<"${review_pages}" >&2
  printf '%s\n' \
    '::error::Breaking API changes require a trusted reviewer approval on the latest commit.' \
    >&2
  exit 1
fi

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  printf '\n> Breaking changes were explicitly approved with `%s` and a review of the latest commit.\n' \
    "${REQUIRED_LABEL}" >>"${GITHUB_STEP_SUMMARY}"
fi

printf 'Breaking API changes have a current, auditable approval.\n'
