#!/usr/bin/env bash
# Makes a strong password for the studio page, shows it ONLY here, and stores a scrambled copy on the server.
# The scrambled copy contains "$" signs; Docker reads .env with variable expansion, so each "$" is stored as "$$".
set -euo pipefail
P=$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-20)
printf '%s\n' "$P" | ssh -i ~/.ssh/lyfe_studio_ed25519 root@2.28.123.22 '
  set -e
  read -r P
  cd /srv/lyfe/repo/deploy
  H=$(docker run --rm caddy:2 caddy hash-password --plaintext "$P")
  H=$(printf "%s" "$H" | sed "s/\\\$/\$\$/g")
  grep -v "^STUDIO_PASSWORD_HASH=" .env > .env.new
  printf "STUDIO_PASSWORD_HASH=%s\n" "$H" >> .env.new
  mv .env.new .env && chmod 600 .env
  docker compose up -d --force-recreate web >/dev/null 2>&1 || true
' >/dev/null
echo
echo "   Studio page user:      rexx"
echo "   Studio page password:  $P"
echo
echo "Write it down now. It is not stored anywhere readable."
unset P
