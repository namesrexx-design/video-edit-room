#!/usr/bin/env bash
# PC → Cloudflare R2. Copies the working media up so the server and every agent can use it.
# Copy only (rclone copy): nothing on R2 or on the PC is ever deleted.
#   bash deploy/media-push.sh            dry run (shows what would upload)
#   bash deploy/media-push.sh --go       upload
set -euo pipefail
cd "$(dirname "$0")"
[ -f .env ] || { echo "deploy/.env missing — copy .env.example and fill the R2 lines"; exit 1; }
set -a; . ./.env; set +a
DRY="--dry-run"; [ "${1:-}" = "--go" ] && DRY=""
B="r2:${R2_BUCKET:-lyfe-studio}"
MEDIA="${LYFE_MEDIA_ROOT:-D:/REXX/AI_Video/BizBox-Garage-Dream}"
CODEX="${LYFE_PC_SOURCE:-C:/Users/16263/Documents/Codex/2026-09-04/referenced-chatgpt-conversation-this-is-an-2}"
EXCL=(--exclude "_superseded/**" --exclude "**/_mistaken-ingest-*/**" --exclude "*.tmp" --exclude "Thumbs.db")
rclone copy "$MEDIA" "$B/media" $DRY "${EXCL[@]}" --transfers 8 --checkers 16 --stats 60s --stats-one-line --log-level NOTICE
rclone copy "$CODEX" "$B/codex-workspace" $DRY "${EXCL[@]}" --exclude "*.bak*" --transfers 8 --checkers 16 --stats 60s --stats-one-line --log-level NOTICE
EDITOR="${LYFE_EDITOR_DIR:-C:/Users/16263/AppData/Local/Temp/claude/C--Users-16263-Desktop-Claude-Code-Build/9d00f0c5-975e-4197-b36d-8f1eb6052b13/scratchpad/film/editor}"
rclone copy "$EDITOR" "$B/editor" $DRY "${EXCL[@]}" --transfers 8 --checkers 16 --stats 60s --stats-one-line --log-level NOTICE
echo "done ${DRY:+(dry run — add --go to upload)}"
