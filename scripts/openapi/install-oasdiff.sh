#!/usr/bin/env bash

set -euo pipefail

readonly OASDIFF_VERSION='1.32.1'
readonly ARCHIVE="oasdiff_${OASDIFF_VERSION}_linux_amd64.tar.gz"
readonly ARCHIVE_SHA256='7c8939fc49b75ee11fec66a5b83b37a2fca6aee109fed85013b1ba2ac2a1ee7f'
readonly RELEASE_URL="https://github.com/oasdiff/oasdiff/releases/download/v${OASDIFF_VERSION}/${ARCHIVE}"
readonly INSTALL_DIR="${OASDIFF_INSTALL_DIR:-${HOME}/.local/bin}"
readonly TEMP_DIR="$(mktemp -d)"

trap 'rm -rf "${TEMP_DIR}"' EXIT

fail() {
  printf 'oasdiff installation failed: %s\n' "$1" >&2
  exit 1
}

[[ "$(uname -s)" == 'Linux' && "$(uname -m)" == 'x86_64' ]] ||
  fail 'only Linux x86_64 is supported by the pinned CI installer'

for command_name in curl install sha256sum tar; do
  command -v "${command_name}" >/dev/null 2>&1 ||
    fail "required command is unavailable: ${command_name}"
done

curl \
  --fail \
  --location \
  --proto '=https' \
  --proto-redir '=https' \
  --show-error \
  --silent \
  --output "${TEMP_DIR}/${ARCHIVE}" \
  "${RELEASE_URL}"

printf '%s  %s\n' "${ARCHIVE_SHA256}" "${TEMP_DIR}/${ARCHIVE}" |
  sha256sum --check --status || fail 'archive checksum does not match'

tar -xzf "${TEMP_DIR}/${ARCHIVE}" -C "${TEMP_DIR}"
mkdir -p "${INSTALL_DIR}"
install -m 0755 "${TEMP_DIR}/oasdiff" "${INSTALL_DIR}/oasdiff"

"${INSTALL_DIR}/oasdiff" --version
