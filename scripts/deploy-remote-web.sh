#!/usr/bin/env bash

set -euo pipefail

HOST="192.168.88.9"
REMOTE_DIR="/root/deploy/txt2voice-web"
SOURCE_ENV="/root/code/txt2voice/.env"
HEALTH_URL=""
BRANCH=""
DRY_RUN=0

usage() {
  cat <<'EOF'
Usage: bash scripts/deploy-remote-web.sh [options]

Options:
  --host <host>              Remote SSH host. Default: 192.168.88.9
  --branch <branch>          Remote branch to deploy. Default: current local branch
  --remote-dir <path>        Remote deploy clone directory. Default: /root/deploy/txt2voice-web
  --source-env <path>        Remote source .env to symlink. Default: /root/code/txt2voice/.env
  --health-url <url>         Health endpoint. Default: http://<host>:3001/api/health
  --dry-run                  Print planned commands only
  -h, --help                 Show help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host)
      HOST="$2"
      shift 2
      ;;
    --branch)
      BRANCH="$2"
      shift 2
      ;;
    --remote-dir)
      REMOTE_DIR="$2"
      shift 2
      ;;
    --source-env)
      SOURCE_ENV="$2"
      shift 2
      ;;
    --health-url)
      HEALTH_URL="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

ROOT_DIR="$(git rev-parse --show-toplevel)"
cd "$ROOT_DIR"

LOCAL_BRANCH="$(git branch --show-current)"

if [[ -z "$BRANCH" ]]; then
  BRANCH="$LOCAL_BRANCH"
fi

if [[ -z "$BRANCH" ]]; then
  echo "Unable to determine branch" >&2
  exit 1
fi

if [[ -z "$LOCAL_BRANCH" ]]; then
  echo "Unable to determine local branch" >&2
  exit 1
fi

if [[ "$BRANCH" != "$LOCAL_BRANCH" ]]; then
  echo \
    "Deploy branch mismatch: local branch is ${LOCAL_BRANCH}, requested branch is ${BRANCH}" >&2
  exit 1
fi

if [[ -z "$HEALTH_URL" ]]; then
  HEALTH_URL="http://${HOST}:3001/api/health"
fi

REPO_URL="$(git remote get-url origin)"
DIRNAME_REMOTE="$(dirname "$REMOTE_DIR")"
DIRTY_COUNT="$(git status --short | wc -l | tr -d ' ')"

REMOTE_SCRIPT=$(cat <<EOF
set -euo pipefail
remote_dir=${REMOTE_DIR}
repo_url=${REPO_URL}
branch=${BRANCH}
source_env=${SOURCE_ENV}
health_url=${HEALTH_URL}
compose_project=txt2voice
needs_build=0

mkdir -p ${DIRNAME_REMOTE}
if [ ! -d ${REMOTE_DIR}/.git ]; then
  git clone ${REPO_URL} ${REMOTE_DIR}
  needs_build=1
fi

cd ${REMOTE_DIR}

if [ -n "\$(git status --short)" ]; then
  echo "Deploy clone is dirty: ${REMOTE_DIR}" >&2
  git status --short >&2
  exit 1
fi

current_remote_branch="\$(git branch --show-current || true)"
if [ -n "\$current_remote_branch" ] && [ "\$current_remote_branch" != "${BRANCH}" ]; then
  echo \
    "Remote deploy branch mismatch: expected ${BRANCH}, got \$current_remote_branch" >&2
  exit 1
fi

git remote set-url origin ${REPO_URL}
previous_rev="\$(git rev-parse HEAD 2>/dev/null || true)"
git fetch origin

if git show-ref --verify --quiet refs/heads/${BRANCH}; then
  git checkout ${BRANCH}
else
  git checkout -B ${BRANCH} origin/${BRANCH}
fi

git pull --ff-only origin ${BRANCH}
current_rev="\$(git rev-parse HEAD)"

if [ "\$needs_build" -eq 0 ] && [ -n "\$previous_rev" ] && [ "\$previous_rev" != "\$current_rev" ]; then
  if git diff --name-only "\$previous_rev" "\$current_rev" -- \
    package.json \
    pnpm-lock.yaml \
    pnpm-workspace.yaml \
    apps/web/package.json \
    apps/web/Dockerfile.dev | grep -q .; then
    needs_build=1
  fi
fi

ln -sfn ${SOURCE_ENV} ${REMOTE_DIR}/.env
docker compose -p txt2voice up -d postgres redis
if [ "\$needs_build" -eq 1 ]; then
  docker compose -p txt2voice build web
fi
docker compose -p txt2voice up -d --no-deps web
docker compose -p txt2voice ps web
for attempt in \$(seq 1 30); do
  if curl -fsS ${HEALTH_URL} >/dev/null; then
    curl -fsS ${HEALTH_URL}
    exit 0
  fi
  sleep 2
done

echo "Health check did not pass: ${HEALTH_URL}" >&2
exit 1
EOF
)

if [[ "$DRY_RUN" -eq 1 ]]; then
  cat <<EOF
local_branch=${BRANCH}
current_local_branch=${LOCAL_BRANCH}
local_dirty_count=${DIRTY_COUNT}
remote_host=${HOST}
remote_dir=${REMOTE_DIR}
repo_url=${REPO_URL}
source_env=${SOURCE_ENV}
health_url=${HEALTH_URL}
----- BEGIN REMOTE SCRIPT -----
${REMOTE_SCRIPT}
----- END REMOTE SCRIPT -----
EOF
  exit 0
fi

if ! git ls-remote --exit-code origin "refs/heads/${BRANCH}" >/dev/null 2>&1; then
  echo "Remote branch does not exist on origin: ${BRANCH}" >&2
  exit 1
fi

echo "Deploying branch ${BRANCH} to ${HOST}:${REMOTE_DIR}"
echo "Local dirty count: ${DIRTY_COUNT}"
echo "This deploy uses origin/${BRANCH}; local uncommitted changes are not included."

ssh "$HOST" "$REMOTE_SCRIPT"
