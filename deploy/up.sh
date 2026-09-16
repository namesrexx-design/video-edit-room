#!/usr/bin/env bash
# Start (or update) the LYFE Studio server: pull the repo, pull media from R2, build the page, start the containers.
#   bash /srv/lyfe/repo/deploy/up.sh
set -euo pipefail
cd /srv/lyfe/repo
[ -f deploy/.env ] || { echo "deploy/.env missing"; exit 1; }
set -a; . deploy/.env; set +a

# repo: pull; set push credentials if a token is present
if [ -n "${GITHUB_TOKEN:-}" ]; then git remote set-url origin "https://x-access-token:${GITHUB_TOKEN}@github.com/namesrexx-design/video-edit-room.git"; fi
git checkout -- projects/garage-dream/STORYBOARD-BOARD.json cut-room/board.json 2>/dev/null || true
git pull --ff-only

cd deploy
docker compose build
docker compose up -d

# media: R2 → server (copy only, never deletes)
docker compose exec -T studio rclone copy "r2:${R2_BUCKET:-lyfe-studio}/media" /data/media --transfers 8 --checkers 16 --stats-one-line
docker compose exec -T studio rclone copy "r2:${R2_BUCKET:-lyfe-studio}/codex-workspace" /data/media/codex-workspace --transfers 8 --checkers 16 --stats-one-line

docker compose exec -T studio rclone copy "r2:${R2_BUCKET:-lyfe-studio}/editor" /data/editor --transfers 8 --checkers 16 --stats-one-line

# page: build the storyboard into /data/editor
docker compose exec -T studio bash -lc 'git config --global --add safe.directory /repo; cp cut-room/storyboard-v2.html /data/editor/storyboard.html; node tools/build-board.mjs'
docker compose ps
echo "Storyboard: http://$(curl -s ifconfig.me)/   (user ${STUDIO_USER:-rexx})"
