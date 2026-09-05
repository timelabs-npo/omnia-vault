#!/usr/bin/env bash
set -euo pipefail
d="$(cd "$(dirname "$0")" && pwd)"
b64="$(mktemp)"; gz="$(mktemp)"; patch="$(mktemp)"
trap 'rm -f "$b64" "$gz" "$patch"' EXIT
cat "$d"/part-* > "$b64"
test "$(wc -c < "$b64" | tr -d ' ')" = "21672"
echo "9e7f0f34746a3a2fe316987bb8f710f0bd054d2444afd385ae8658f1257b385b  $b64" | shasum -a 256 -c -
base64 -D < "$b64" > "$gz" 2>/dev/null || base64 -d < "$b64" > "$gz"
test "$(wc -c < "$gz" | tr -d ' ')" = "16253"
echo "c1ebe27815e6e84f0cb5520cd75e536c3846ad92d6d9daa3f80513fd0acc08bb  $gz" | shasum -a 256 -c -
gzip -dc "$gz" > "$patch"
test "$(wc -c < "$patch" | tr -d ' ')" = "84637"
echo "594bab835d3f0a909efd70a312992ca5a3a666025309a5128e20cabc57697c47  $patch" | shasum -a 256 -c -
echo "verified exact patch: $patch"
