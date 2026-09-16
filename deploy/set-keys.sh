#!/usr/bin/env bash
# Saves the Cloudflare R2 key into deploy/.env (PC) and copies it to the server. Values are typed, never shown.
set -euo pipefail
cd "$(dirname "$0")"
read -rp  "Paste the Access Key ID, then Enter: " K
read -rsp "Paste the Secret Access Key (it stays hidden), then Enter: " S; echo
[ -n "$K" ] && [ -n "$S" ] || { echo "Nothing pasted, nothing saved."; exit 1; }
sed -i "s#^RCLONE_CONFIG_R2_ACCESS_KEY_ID=.*#RCLONE_CONFIG_R2_ACCESS_KEY_ID=$K#; s#^RCLONE_CONFIG_R2_SECRET_ACCESS_KEY=.*#RCLONE_CONFIG_R2_SECRET_ACCESS_KEY=$S#" .env
printf "%s
%s
" "$K" "$S" | ssh -i ~/.ssh/lyfe_studio_ed25519 root@2.28.123.22 'cd /srv/lyfe/repo/deploy && read -r K && read -r S && sed -i "s#^RCLONE_CONFIG_R2_ACCESS_KEY_ID=.*#RCLONE_CONFIG_R2_ACCESS_KEY_ID=$K#; s#^RCLONE_CONFIG_R2_SECRET_ACCESS_KEY=.*#RCLONE_CONFIG_R2_SECRET_ACCESS_KEY=$S#; s#^RCLONE_CONFIG_R2_ENDPOINT=.*#RCLONE_CONFIG_R2_ENDPOINT=https://54993e52d5fb96ac36467b693d767a0a.r2.cloudflarestorage.com#" .env'
unset K S
echo "Key saved on the PC and the server."
