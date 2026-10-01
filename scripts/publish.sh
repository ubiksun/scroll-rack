#!/usr/bin/env bash
# Push the monorepo subtree to the public repo. Usage: scripts/publish.sh [--rewrite-remote]
#   1. subtree split → branch scroll-rack-public (deterministic: same monorepo history → same SHAs)
#   2. public history is English-only: scripts/public-messages/<split-sha>.txt replaces that commit's
#      message → branch scroll-rack-public-en (also deterministic, so later pushes still fast-forward)
#   3. abort if any commit subject still contains CJK — write a message file for it, rerun
#   4. push scroll-rack-public-en → scroll-rack main; fast-forward only unless --rewrite-remote
#      (then --force-with-lease pinned to the fetched tip)
set -euo pipefail
cd "$(dirname "$0")/.."
PREFIX=Areas/MTG/tools/limited-grader
HERE="$(pwd)"
MSGDIR="$HERE/scripts/public-messages"
REMOTE=scroll-rack
cd "$(git rev-parse --show-toplevel)"

git subtree split --prefix="$PREFIX" -b scroll-rack-public >/dev/null
python3 "$HERE/scripts/public_history.py" scroll-rack-public scroll-rack-public-en >/dev/null

cjk() { perl -CSD -ne 'print if /[\x{3000}-\x{9FFF}\x{FF00}-\x{FFEF}]/'; }
if [ -n "$(git log --format='%s' scroll-rack-public-en | cjk)" ]; then
  echo "CJK in public commit subjects — write scripts/public-messages/<sha>.txt (English message) for each, then rerun:" >&2
  git log --format='%H %s' scroll-rack-public | cjk | while read -r sha subj; do
    [ -f "$MSGDIR/$sha.txt" ] || echo "  $sha $subj" >&2
  done
  exit 1
fi

git fetch -q "$REMOTE" main
REMOTE_TIP=$(git rev-parse "$REMOTE/main")
NEW_TIP=$(git rev-parse scroll-rack-public-en)
if [ "$REMOTE_TIP" = "$NEW_TIP" ]; then echo "public repo already at $NEW_TIP"; exit 0; fi
if git merge-base --is-ancestor "$REMOTE_TIP" "$NEW_TIP"; then
  git push "$REMOTE" scroll-rack-public-en:main
elif [ "${1:-}" = "--rewrite-remote" ]; then
  git push --force-with-lease=main:"$REMOTE_TIP" "$REMOTE" scroll-rack-public-en:main
  echo "history rewritten — remote tags not on the new main (move them):"
  git ls-remote --tags "$REMOTE" | while read -r sha ref; do
    git merge-base --is-ancestor "$sha" "$NEW_TIP" 2>/dev/null || echo "  $ref $sha"
  done
else
  echo "remote main ($REMOTE_TIP) is not an ancestor of $NEW_TIP." >&2
  echo "If GitHub has web edits, pull them into the monorepo first; if this is an intended rewrite, rerun with --rewrite-remote." >&2
  exit 1
fi
