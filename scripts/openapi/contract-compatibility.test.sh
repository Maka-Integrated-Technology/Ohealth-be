#!/usr/bin/env bash

set -euo pipefail

readonly REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
readonly BASE_FIXTURE="${REPO_ROOT}/test/fixtures/openapi/compatibility/base.json"
readonly OASDIFF_BIN="${OASDIFF_BIN:-oasdiff}"
readonly TEMP_DIR="$(mktemp -d)"

trap 'rm -rf "${TEMP_DIR}"' EXIT

fail() {
  printf 'Contract compatibility test failed: %s\n' "$1" >&2
  exit 1
}

for command_name in "${OASDIFF_BIN}" jq; do
  command -v "${command_name}" >/dev/null 2>&1 ||
    fail "required command is unavailable: ${command_name}"
done

"${OASDIFF_BIN}" validate "${BASE_FIXTURE}" \
  --allow-external-refs=false --fail-on WARN >/dev/null

jq '
  .info.version = "1.1.0" |
  .components.schemas.Item.properties.description = {"type": "string"}
' "${BASE_FIXTURE}" >"${TEMP_DIR}/additive.json"

"${OASDIFF_BIN}" breaking \
  "${BASE_FIXTURE}" \
  "${TEMP_DIR}/additive.json" \
  --allow-external-refs=false \
  --fail-on WARN >/dev/null || fail 'additive change was classified as breaking'

jq 'del(.paths["/items"].get)' \
  "${BASE_FIXTURE}" >"${TEMP_DIR}/removed-operation.json"
jq '
  del(.components.schemas.Item.properties.name) |
  .components.schemas.Item.required = ["id"]
' "${BASE_FIXTURE}" >"${TEMP_DIR}/removed-response-field.json"
jq '
  .components.schemas.CreateItem.properties.category.enum = ["general"]
' "${BASE_FIXTURE}" >"${TEMP_DIR}/narrowed-request-enum.json"
jq '
  .components.schemas.CreateItem.properties.reference = {"type": "string"} |
  .components.schemas.CreateItem.required += ["reference"]
' "${BASE_FIXTURE}" >"${TEMP_DIR}/new-required-request-field.json"

for fixture_name in \
  removed-operation \
  removed-response-field \
  narrowed-request-enum \
  new-required-request-field; do
  breaking_exit=0
  "${OASDIFF_BIN}" breaking \
    "${BASE_FIXTURE}" \
    "${TEMP_DIR}/${fixture_name}.json" \
    --allow-external-refs=false \
    --fail-on WARN >/dev/null 2>&1 || breaking_exit=$?

  [[ "${breaking_exit}" -eq 1 ]] ||
    fail "${fixture_name} was not classified as breaking"
done

jq '
  .paths["/items"].get.responses["200"].content["application/json"].schema.items =
    {"$ref": "#/components/schemas/MissingItem"}
' "${BASE_FIXTURE}" >"${TEMP_DIR}/invalid-reference.json"

if "${OASDIFF_BIN}" validate "${TEMP_DIR}/invalid-reference.json" \
  --allow-external-refs=false --fail-on ERR >/dev/null 2>&1; then
  fail 'unresolved reference fixture passed validation'
fi

GITHUB_OUTPUT="${TEMP_DIR}/additive-output.txt" \
bash "${REPO_ROOT}/scripts/openapi/analyze-contract-change.sh" \
  "${BASE_FIXTURE}" \
  "${TEMP_DIR}/additive.json" \
  "${TEMP_DIR}/additive-report.md" >/dev/null

grep -qx 'breaking_changes=false' "${TEMP_DIR}/additive-output.txt" ||
  fail 'additive analysis did not emit breaking_changes=false'

grep -q 'API Contract Compatibility Report' "${TEMP_DIR}/additive-report.md" ||
  fail 'additive analysis did not create a readable report'

grep -q '^#### API Changes$' "${TEMP_DIR}/additive-report.md" ||
  fail 'additive analysis did not preserve readable heading hierarchy'

GITHUB_OUTPUT="${TEMP_DIR}/breaking-output.txt" \
bash "${REPO_ROOT}/scripts/openapi/analyze-contract-change.sh" \
  "${BASE_FIXTURE}" \
  "${TEMP_DIR}/removed-operation.json" \
  "${TEMP_DIR}/breaking-report.md" >/dev/null

grep -qx 'breaking_changes=true' "${TEMP_DIR}/breaking-output.txt" ||
  fail 'breaking analysis did not emit breaking_changes=true'

if BREAKING_CHANGES=true APPROVAL_LABEL_PRESENT=false \
  bash "${REPO_ROOT}/scripts/openapi/enforce-breaking-approval.sh" \
  >/dev/null 2>&1; then
  fail 'breaking changes passed without the approval label'
fi

cat >"${TEMP_DIR}/gh" <<'MOCK'
#!/usr/bin/env bash
cat "${MOCK_REVIEW_DATA}"
MOCK
chmod 0755 "${TEMP_DIR}/gh"

cat >"${TEMP_DIR}/current-approval.json" <<'JSON'
{
  "commits": [{"oid": "current-head"}],
  "reviewDecision": "APPROVED",
  "reviews": [{"state": "APPROVED", "commit": {"oid": "current-head"}}]
}
JSON

PATH="${TEMP_DIR}:${PATH}" \
MOCK_REVIEW_DATA="${TEMP_DIR}/current-approval.json" \
BREAKING_CHANGES=true \
APPROVAL_LABEL_PRESENT=true \
GH_TOKEN=test-token \
GITHUB_REPOSITORY=example/repository \
PR_NUMBER=1 \
bash "${REPO_ROOT}/scripts/openapi/enforce-breaking-approval.sh" >/dev/null

cat >"${TEMP_DIR}/stale-approval.json" <<'JSON'
{
  "commits": [{"oid": "current-head"}],
  "reviewDecision": "APPROVED",
  "reviews": [{"state": "APPROVED", "commit": {"oid": "previous-head"}}]
}
JSON

if PATH="${TEMP_DIR}:${PATH}" \
  MOCK_REVIEW_DATA="${TEMP_DIR}/stale-approval.json" \
  BREAKING_CHANGES=true \
  APPROVAL_LABEL_PRESENT=true \
  GH_TOKEN=test-token \
  GITHUB_REPOSITORY=example/repository \
  PR_NUMBER=1 \
  bash "${REPO_ROOT}/scripts/openapi/enforce-breaking-approval.sh" >/dev/null 2>&1; then
  fail 'approval for a previous commit was accepted'
fi

cat >"${TEMP_DIR}/invalidated-approval.json" <<'JSON'
{
  "commits": [{"oid": "current-head"}],
  "reviewDecision": "CHANGES_REQUESTED",
  "reviews": [
    {"state": "APPROVED", "commit": {"oid": "current-head"}},
    {"state": "CHANGES_REQUESTED", "commit": {"oid": "current-head"}}
  ]
}
JSON

if PATH="${TEMP_DIR}:${PATH}" \
  MOCK_REVIEW_DATA="${TEMP_DIR}/invalidated-approval.json" \
  BREAKING_CHANGES=true \
  APPROVAL_LABEL_PRESENT=true \
  GH_TOKEN=test-token \
  GITHUB_REPOSITORY=example/repository \
  PR_NUMBER=1 \
  bash "${REPO_ROOT}/scripts/openapi/enforce-breaking-approval.sh" >/dev/null 2>&1; then
  fail 'an invalidated approval was accepted'
fi

printf 'Contract compatibility controls passed.\n'
