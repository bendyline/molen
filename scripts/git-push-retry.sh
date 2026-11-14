#!/bin/sh
# Stands in for git on the PATH of the Release workflow's versioning step: `git push` is retried,
# every other command goes straight to the git named by REAL_GIT.
#
# GitHub once refused a tag push ("remote rejected ... (missing necessary objects)", run
# 43504403985) for the same commit it had accepted six tags on half a second earlier, and
# semantic-release does not retry: the release stopped with some packages tagged and none
# published. Pushing refs GitHub already has again changes nothing, so a retry is safe. Dry runs
# (semantic-release's permission check) are not retried.
#
# GIT_PUSH_RETRY_ATTEMPTS (default 4) and GIT_PUSH_RETRY_DELAY (seconds, default 10; attempt n
# waits n times as long) tune it.
set -u
: "${REAL_GIT:?REAL_GIT must name the real git executable}"

if [ "${1-}" != push ]; then exec "$REAL_GIT" "$@"; fi
for arg in "$@"; do
  case "$arg" in
    -n | --dry-run) exec "$REAL_GIT" "$@" ;;
  esac
done

attempts=${GIT_PUSH_RETRY_ATTEMPTS:-4}
delay=${GIT_PUSH_RETRY_DELAY:-10}
attempt=1
while :; do
  "$REAL_GIT" "$@" && exit 0
  status=$?
  if [ "$attempt" -ge "$attempts" ]; then exit "$status"; fi
  wait=$((attempt * delay))
  echo "git push failed (exit $status) on attempt $attempt of $attempts; retrying in ${wait}s." >&2
  sleep "$wait"
  attempt=$((attempt + 1))
done
