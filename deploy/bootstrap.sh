#!/usr/bin/env bash
# One-time setup of the LYFE Studio server on a fresh Hetzner Ubuntu box. Run as root:
#   curl -fsSL https://raw.githubusercontent.com/namesrexx-design/video-edit-room/main/deploy/bootstrap.sh | bash
# Then put deploy/.env in place (see .env.example) and run:  bash /srv/lyfe/repo/deploy/up.sh
set -euo pipefail

# 1. Docker
if ! command -v docker >/dev/null; then curl -fsSL https://get.docker.com | sh; fi

# 2. folders
mkdir -p /srv/lyfe/media /srv/lyfe/editor

# 3. the repo (public, so no token needed to read)
if [ ! -d /srv/lyfe/repo/.git ]; then git clone https://github.com/namesrexx-design/video-edit-room.git /srv/lyfe/repo; fi

# 4. a firewall that only allows ssh + web
if command -v ufw >/dev/null; then ufw allow OpenSSH; ufw allow 80; ufw allow 443; yes | ufw enable || true; fi

echo
echo "Next: create /srv/lyfe/repo/deploy/.env (copy .env.example, fill it), then run:"
echo "  bash /srv/lyfe/repo/deploy/up.sh"
