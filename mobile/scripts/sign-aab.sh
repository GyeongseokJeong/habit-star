#!/usr/bin/env bash
set -euo pipefail
input=${1:?Input AAB required}
output=${2:?Output AAB required}
keystore=${3:?Keystore required}
alias=${4:?Key alias required}
: "${STORE_PASS:?Missing store password}" "${KEY_PASS:?Missing key password}"
[[ -f "$input" && -f "$keystore" && ! -e "$output" ]]
tmp=$(mktemp "${output}.XXXXXX")
trap 'rm -f "$tmp"' EXIT
jarsigner -keystore "$keystore" -storepass:env STORE_PASS -keypass:env KEY_PASS -signedjar "$tmp" "$input" "$alias"
jarsigner -verify -strict -keystore "$keystore" -storepass:env STORE_PASS "$tmp" "$alias"
mv "$tmp" "$output"
