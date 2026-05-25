#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_SLUG="${REPO_SLUG:-fighttechvn/openx}"
PAGES_BRANCH="${PAGES_BRANCH:-gh-pages}"
PAGES_DIR="$ROOT_DIR/dashboard"
TMP_DIR="$(mktemp -d)"
PAGES_WORKTREE="$TMP_DIR-pages"

cleanup() {
  if [[ -d "$PAGES_WORKTREE" ]]; then
    git -C "$ROOT_DIR" worktree remove --force "$PAGES_WORKTREE" >/dev/null 2>&1 || true
  fi
  git -C "$ROOT_DIR" worktree prune >/dev/null 2>&1 || true
  rm -rf "$TMP_DIR"
}

trap cleanup EXIT

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_command git
require_command curl

if [[ ! -d "$PAGES_DIR" ]]; then
  echo "Missing dashboard directory: $PAGES_DIR" >&2
  exit 1
fi

if ! git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "This project is not a git repository. Run git init and push source first." >&2
  exit 1
fi

if ! git -C "$ROOT_DIR" remote get-url origin >/dev/null 2>&1; then
  echo "Missing git remote: origin" >&2
  echo "Expected: git remote add origin git@github.com:${REPO_SLUG}.git" >&2
  exit 1
fi

echo "Preparing GitHub Pages deployment for $REPO_SLUG"

cp -R "$PAGES_DIR"/. "$TMP_DIR"/
touch "$TMP_DIR/.nojekyll"

cat > "$TMP_DIR/README.md" <<EOF
# OpenX Mirror Dashboard

Static dashboard deployed from \`dashboard/\`.

Source repository: https://github.com/${REPO_SLUG}
EOF

if git -C "$ROOT_DIR" ls-remote --exit-code --heads origin "$PAGES_BRANCH" >/dev/null 2>&1; then
  git -C "$ROOT_DIR" fetch origin "$PAGES_BRANCH"
  git -C "$ROOT_DIR" worktree add --force "$PAGES_WORKTREE" "origin/$PAGES_BRANCH"
elif git -C "$ROOT_DIR" show-ref --verify --quiet "refs/heads/$PAGES_BRANCH"; then
  git -C "$ROOT_DIR" worktree add --force "$PAGES_WORKTREE" "$PAGES_BRANCH"
else
  git -C "$ROOT_DIR" worktree add --force --detach "$PAGES_WORKTREE"
  git -C "$PAGES_WORKTREE" switch --orphan "$PAGES_BRANCH"
fi

find "$PAGES_WORKTREE" -mindepth 1 -maxdepth 1 ! -name ".git" -exec rm -rf {} +
cp -R "$TMP_DIR"/. "$PAGES_WORKTREE"/

git -C "$PAGES_WORKTREE" add -A
if git -C "$PAGES_WORKTREE" diff --cached --quiet; then
  echo "No dashboard changes to deploy."
else
  git -C "$PAGES_WORKTREE" commit -m "Deploy dashboard to GitHub Pages"
fi

git -C "$PAGES_WORKTREE" push origin "HEAD:$PAGES_BRANCH"

TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
if [[ -n "$TOKEN" ]]; then
  echo "Enabling GitHub Pages from $PAGES_BRANCH / root"
  curl -fsS -X POST "https://api.github.com/repos/${REPO_SLUG}/pages" \
    -H "Accept: application/vnd.github+json" \
    -H "Authorization: Bearer $TOKEN" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    -d "{\"source\":{\"branch\":\"${PAGES_BRANCH}\",\"path\":\"/\"}}" >/dev/null \
    || curl -fsS -X PUT "https://api.github.com/repos/${REPO_SLUG}/pages" \
      -H "Accept: application/vnd.github+json" \
      -H "Authorization: Bearer $TOKEN" \
      -H "X-GitHub-Api-Version: 2022-11-28" \
      -d "{\"source\":{\"branch\":\"${PAGES_BRANCH}\",\"path\":\"/\"}}" >/dev/null
else
  echo "GH_TOKEN/GITHUB_TOKEN not found. If Pages is not enabled yet, enable it in GitHub:"
  echo "Settings -> Pages -> Deploy from a branch -> $PAGES_BRANCH / root"
fi

echo "Dashboard URL:"
echo "https://fighttechvn.github.io/openx/"
