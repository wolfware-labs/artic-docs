#!/usr/bin/env bash
# Runs the built site image and checks routing, headers and the runtime user.
# Usage: scripts/smoke-image.sh <image-ref>
set -euo pipefail

image="${1:?usage: smoke-image.sh <image-ref>}"
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

marker="$(grep -o '<title>[^<]*' "$root/dist/404.html" | head -1 | sed 's/^<title>//')"
[ -n "$marker" ] || { echo "FAIL: no <title> in dist/404.html"; exit 1; }

cid=""
tmp="$(mktemp -d)"
cleanup() {
  [ -z "$cid" ] || docker rm -f "$cid" >/dev/null 2>&1 || true
  rm -rf "$tmp"
}
trap cleanup EXIT

fail() { echo "FAIL: $1"; exit 1; }
ok() { echo "ok: $1"; }

cid="$(docker run -d -p 127.0.0.1::8080 "$image")" || fail "container starts"
port="$(docker port "$cid" 8080/tcp | head -1 | sed 's/.*://')"
base="http://127.0.0.1:$port"

ready=""
for _ in $(seq 1 20); do
  if curl -fsS -o /dev/null "$base/" 2>/dev/null; then ready=1; break; fi
  sleep 0.5
done
[ -n "$ready" ] || fail "/ answers within 10s"

# Fetches a path, leaving status in $status, headers in $tmp/h, body in $tmp/b.
get() {
  status="$(curl -sS -D "$tmp/h" -o "$tmp/b" -w '%{http_code}' "$base$1")"
}
header() { grep -i "^$1:" "$tmp/h" | head -1 | cut -d: -f2- | tr -d '\r' | sed 's/^ *//'; }

get /
[ "$status" = 200 ] || fail "/ returns 200 (got $status)"
grep -q '<title>' "$tmp/b" || fail "/ body contains <title>"
ok "/ returns 200 with a title"
cp "$tmp/b" "$tmp/index.html"
cp "$tmp/h" "$tmp/index.h"

[ "$(header Cache-Control)" = "no-cache" ] || fail "/ Cache-Control is no-cache"
ok "/ Cache-Control: no-cache"
[ "$(header X-Content-Type-Options)" = "nosniff" ] || fail "/ X-Content-Type-Options is nosniff"
ok "/ X-Content-Type-Options: nosniff"
[ "$(header Referrer-Policy)" = "strict-origin-when-cross-origin" ] || fail "/ Referrer-Policy"
ok "/ Referrer-Policy: strict-origin-when-cross-origin"
if header Server | grep -Eq '[0-9]'; then fail "/ Server hides the nginx version"; fi
ok "/ Server has no version"

get /docs/
[ "$status" = 200 ] || fail "/docs/ returns 200 (got $status)"
ok "/docs/ returns 200"

get /docs
[ "$status" = 301 ] || fail "/docs returns 301 (got $status)"
[ "$(header Location)" = "/docs/" ] || fail "/docs Location is /docs/ (got $(header Location))"
ok "/docs redirects to /docs/"

get /no-such-page/
[ "$status" = 404 ] || fail "/no-such-page/ returns 404 (got $status)"
grep -qF "$marker" "$tmp/b" || fail "404 body contains '$marker'"
ok "/no-such-page/ returns the 404 page"

css="$(grep -o '/_astro/[^"]*\.css' "$tmp/index.html" | head -1)"
[ -n "$css" ] || fail "/ references a /_astro css file"
get "$css"
[ "$status" = 200 ] || fail "$css returns 200 (got $status)"
[ "$(header Cache-Control)" = "public, max-age=31536000, immutable" ] || fail "$css Cache-Control is immutable"
ok "$css is cached as immutable"
[ "$(header X-Content-Type-Options)" = "nosniff" ] || fail "$css keeps security headers"
ok "$css keeps security headers"

uid="$(docker exec "$cid" id -u)"
[ "$uid" != 0 ] || fail "container user is not root"
ok "container runs as uid $uid"
