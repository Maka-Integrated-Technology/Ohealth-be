#!/usr/bin/env bash

set -euo pipefail

readonly REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
readonly SCANNER="$REPO_ROOT/scripts/security/supply-chain-scan.sh"
readonly FIXTURE_ROOT="$(mktemp -d)"
readonly -a CAMPAIGN_TEST_MARKERS=(
  'Tgw''(2509)'
  '_$_''1e42'
  'rmcej%''otb%'
  'eth_getBlock''ByNumber'
  'publicnode.''com'
  'drpc.''org'
  'blastapi.''io'
  '1rpc.''io'
  'block''scout'
  'webhook.''site'
  'shai-''hulud'
)

trap 'rm -rf "$FIXTURE_ROOT"' EXIT

fail() {
  printf 'Scanner test failed: %s\n' "$1" >&2
  exit 1
}

create_fixture() {
  local fixture="$FIXTURE_ROOT/$1"

  mkdir -p "$fixture/scripts/security"
  cp "$SCANNER" "$fixture/scripts/security/supply-chain-scan.sh"

  cat >"$fixture/.npmrc" <<'NPMRC'
ignore-scripts=true
NPMRC

  cat >"$fixture/package.json" <<'JSON'
{
  "name": "scanner-fixture",
  "version": "1.0.0",
  "scripts": {}
}
JSON

  cat >"$fixture/package-lock.json" <<'JSON'
{
  "name": "scanner-fixture",
  "version": "1.0.0",
  "lockfileVersion": 3,
  "packages": {
    "": {
      "name": "scanner-fixture",
      "version": "1.0.0"
    },
    "node_modules/example": {
      "version": "1.0.0",
      "resolved": "https://registry.npmjs.org/example/-/example-1.0.0.tgz",
      "integrity": "sha512-reviewed"
    }
  }
}
JSON

  git -C "$fixture" init --quiet
  git -C "$fixture" add .npmrc package.json package-lock.json scripts/security/supply-chain-scan.sh
  printf '%s\n' "$fixture"
}

update_json() {
  local file="$1"
  local filter="$2"
  local replacement="$file.next"

  jq "$filter" "$file" >"$replacement"
  mv "$replacement" "$file"
}

expect_pass() {
  local fixture="$1"
  local label="$2"

  if ! (cd "$fixture" && bash scripts/security/supply-chain-scan.sh) >/dev/null 2>&1; then
    fail "$label should pass"
  fi
}

expect_fail() {
  local fixture="$1"
  local label="$2"

  if (cd "$fixture" && bash scripts/security/supply-chain-scan.sh) >/dev/null 2>&1; then
    fail "$label should fail closed"
  fi
}

clean_fixture=$(create_fixture clean)
expect_pass "$clean_fixture" 'reviewed package metadata'

legitimate_indentation_fixture=$(create_fixture legitimate-indentation)
printf '%80sconst visible = true;\n' '' \
  >"$legitimate_indentation_fixture/legitimate.config.js"
git -C "$legitimate_indentation_fixture" add legitimate.config.js
expect_pass "$legitimate_indentation_fixture" 'legitimate deep indentation'

hidden_whitespace_fixture=$(create_fixture hidden-whitespace)
printf 'const visible = true;%120sconst hidden = true;\n' '' \
  >"$hidden_whitespace_fixture/hidden.config.js"
git -C "$hidden_whitespace_fixture" add hidden.config.js
expect_fail "$hidden_whitespace_fixture" 'hidden whitespace payload'

for index in "${!CAMPAIGN_TEST_MARKERS[@]}"; do
  marker_fixture=$(create_fixture "marker-$index")
  printf 'export const indicator = "%s";\n' "${CAMPAIGN_TEST_MARKERS[$index]}" \
    >"$marker_fixture/indicator.ts"
  git -C "$marker_fixture" add indicator.ts
  expect_fail "$marker_fixture" "campaign marker ${CAMPAIGN_TEST_MARKERS[$index]}"
done

oversized_config_fixture=$(create_fixture oversized-config)
for index in {1..300}; do
  printf 'export const value_%03d = "%040d";\n' "$index" "$index"
done >"$oversized_config_fixture/oversized.config.js"
git -C "$oversized_config_fixture" add oversized.config.js
expect_fail "$oversized_config_fixture" 'oversized configuration file'

dynamic_config_fixture=$(create_fixture dynamic-config)
printf 'global["loader"] = require;\n' >"$dynamic_config_fixture/metro.config.js"
git -C "$dynamic_config_fixture" add metro.config.js
expect_fail "$dynamic_config_fixture" 'dynamic config execution'

long_line_fixture=$(create_fixture long-line)
printf 'const payload = "%4097s";\n' '' >"$long_line_fixture/payload.ts"
git -C "$long_line_fixture" add payload.ts
expect_fail "$long_line_fixture" 'abnormally long executable line'

for hook in preinstall install postinstall prepublish preprepare postprepare dependencies; do
  hook_fixture=$(create_fixture "hook-$hook")
  update_json "$hook_fixture/package.json" ".scripts.${hook} = \"malicious-command\""
  expect_fail "$hook_fixture" "unapproved $hook lifecycle hook"
done

unreviewed_prepare_fixture=$(create_fixture unreviewed-prepare)
update_json \
  "$unreviewed_prepare_fixture/package.json" \
  '.scripts.prepare = "husky && malicious-command"'
expect_fail "$unreviewed_prepare_fixture" 'unreviewed prepare lifecycle command'

missing_npmrc_fixture=$(create_fixture missing-npmrc)
rm "$missing_npmrc_fixture/.npmrc"
expect_fail "$missing_npmrc_fixture" 'missing scripts-disabled policy'

missing_resolved_fixture=$(create_fixture missing-resolved)
update_json \
  "$missing_resolved_fixture/package-lock.json" \
  'del(.packages["node_modules/example"].resolved)'
expect_fail "$missing_resolved_fixture" 'missing resolved metadata'

missing_integrity_fixture=$(create_fixture missing-integrity)
update_json \
  "$missing_integrity_fixture/package-lock.json" \
  'del(.packages["node_modules/example"].integrity)'
expect_fail "$missing_integrity_fixture" 'missing integrity metadata'

untrusted_source_fixture=$(create_fixture untrusted-source)
update_json \
  "$untrusted_source_fixture/package-lock.json" \
  '.packages["node_modules/example"].resolved = "https://example.invalid/package.tgz"'
expect_fail "$untrusted_source_fixture" 'untrusted dependency source'

missing_packages_fixture=$(create_fixture missing-packages)
update_json "$missing_packages_fixture/package-lock.json" 'del(.packages)'
expect_fail "$missing_packages_fixture" 'missing packages object'

malformed_entry_fixture=$(create_fixture malformed-entry)
update_json \
  "$malformed_entry_fixture/package-lock.json" \
  '.packages["node_modules/example"] = "invalid"'
expect_fail "$malformed_entry_fixture" 'malformed package entry'

malformed_scripts_fixture=$(create_fixture malformed-scripts)
update_json "$malformed_scripts_fixture/package.json" '.scripts = "invalid"'
expect_fail "$malformed_scripts_fixture" 'malformed scripts object'

printf 'Supply-chain scanner adversarial tests passed.\n'
