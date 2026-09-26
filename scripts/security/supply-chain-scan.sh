#!/usr/bin/env bash

set -euo pipefail

readonly REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
readonly MAX_CONFIG_BYTES=8192
readonly MAX_EXECUTABLE_LINE_LENGTH=4096

cd "$REPO_ROOT"

fail() {
  printf '::error::%s\n' "$1" >&2
  exit 1
}

for command_name in git grep awk od tr jq wc; do
  command -v "$command_name" >/dev/null 2>&1 ||
    fail "Required scanner command is unavailable: $command_name"
done

git rev-parse --is-inside-work-tree >/dev/null 2>&1 ||
  fail 'Supply-chain scan must run inside a Git worktree.'

# Keep signatures split so the scanner does not detect its own source.
readonly -a KNOWN_CAMPAIGN_MARKERS=(
  'Tgw''(2509)'
  '_$_''1e42'
  'rmcej%''otb%'
  'temp_auto_''push.bat'
  'temp_interactive_''push.bat'
  'branch_''structure.json'
  '0xa322E5f3''D311D3080e6f0121063e9aDC2490Ef1a'
  'eth_getBlock''ByNumber'
  'publicnode.''com'
  'drpc.''org'
  'blastapi.''io'
  '1rpc.''io'
  'block''scout'
  'webhook.''site'
  'shai-''hulud'
  'shai_''hulud'
  'shai''hulud'
)

for marker in "${KNOWN_CAMPAIGN_MARKERS[@]}"; do
  if matches=$(git grep -FIl -- "$marker" -- . ':(exclude).gitignore'); then
    fail "Known malicious campaign marker detected in: ${matches//$'\n'/, }"
  fi
done

while IFS= read -r -d '' config_file; do
  config_size=$(wc -c <"$config_file")
  if [[ "$config_size" -gt "$MAX_CONFIG_BYTES" ]]; then
    fail "Configuration file $config_file is unexpectedly large (${config_size} bytes)."
  fi

  if grep -Pq '[ \t]{120,}\S' "$config_file"; then
    fail "Long hidden-whitespace run detected in $config_file."
  fi

  if grep -Eqi '_0x[[:xdigit:]]{4,}|global\[[^]]+\][[:space:]]*=[[:space:]]*require|String\.fromCharCode\([^)]{100,}|node:child_process|\beval[[:space:]]*\(|Function\([[:space:]]*atob|spawn\([^)]*-e|createRequire\([[:space:]]*import\.meta\.url|Tgw\([[:digit:]]+\)' "$config_file"; then
    fail "Obfuscated or dynamic executable configuration detected in $config_file."
  fi
done < <(
  git ls-files -z \
    '*.config.js' '*.config.cjs' '*.config.mjs' \
    '*.config.ts' '*.config.mts'
)

while IFS= read -r -d '' task_file; do
  if grep -Eqi '"runOn"[[:space:]]*:[[:space:]]*"folderOpen"|curl.+\|.+(ba)?sh|powershell' "$task_file"; then
    fail "Unsafe editor task detected in $task_file."
  fi
done < <(git ls-files -z '.vscode/tasks.json' '*/.vscode/tasks.json')

while IFS= read -r -d '' font_file; do
  magic=$(od -An -tx1 -N4 "$font_file" | tr -d ' \n')
  case "$magic" in
    774f4632 | 774f4646 | 4f54544f | 00010000) ;;
    *) fail "Invalid font signature in $font_file; possible disguised payload." ;;
  esac
done < <(git ls-files -z '*.woff' '*.woff2' '*.otf' '*.ttf')

[[ -f package.json ]] || fail 'package.json is missing.'
[[ -f package-lock.json ]] || fail 'package-lock.json is missing.'
[[ -f .npmrc ]] || fail '.npmrc is missing.'
grep -Eq '^ignore-scripts=true$' .npmrc ||
  fail '.npmrc must disable dependency lifecycle scripts.'

if ! jq -e '
  type == "object" and
  (
    (.scripts // {}) as $scripts |
    ($scripts | type == "object") and
    all(
      [
        "preinstall",
        "install",
        "postinstall",
        "prepublish",
        "preprepare",
        "postprepare",
        "dependencies"
      ][];
      ($scripts[.]? // "") == ""
    ) and
    (($scripts.prepare? // "") == "" or $scripts.prepare == "husky")
  )
' package.json >/dev/null; then
  fail 'package.json is malformed or contains an unapproved install lifecycle script.'
fi

if ! jq -e '
  type == "object" and
  .lockfileVersion == 3 and
  (.packages | type == "object") and
  (.packages | has("")) and
  all(
    .packages | to_entries[];
    if .key == "" then
      (.value | type == "object")
    else
      (.value | type == "object") and
      (.value.resolved | type == "string") and
      (.value.resolved | startswith("https://registry.npmjs.org/")) and
      (.value.integrity | type == "string") and
      (.value.integrity | length > 0)
    end
  )
' package-lock.json >/dev/null; then
  fail 'package-lock.json is malformed or contains untrusted or incomplete dependency metadata.'
fi

long_line_found=0
while IFS= read -r -d '' source_file; do
  if ! awk -v max="$MAX_EXECUTABLE_LINE_LENGTH" '
    length($0) > max {
      printf "%s:%d: executable line exceeds %d characters\n", FILENAME, FNR, max
      exit 1
    }
  ' "$source_file"; then
    long_line_found=1
  fi
done < <(
  git ls-files -z \
    '*.js' '*.cjs' '*.mjs' '*.jsx' \
    '*.ts' '*.mts' '*.tsx' '*.json' '*.sh'
)

[[ "$long_line_found" -eq 0 ]] ||
  fail 'Abnormally long line found in tracked executable source.'

printf 'Supply-chain security scan passed.\n'
