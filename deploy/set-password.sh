#!/usr/bin/env bash
# Makes a strong password for the studio page, shows it ONLY here, and stores a scrambled copy on the server.
set -euo pipefail
P=$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-20)
ssh -i ~/.ssh/lyfe_studio_ed25519 root@2.28.123.22 "cd /srv/lyfe/repo/deploy && H=\$(docker run --rm caddy:2 caddy hash-password --plaintext '$P') && sed -i \"s#^STUDIO_PASSWORD_HASH=.*#STUDIO_PASSWORD_HASH=\$H#\" .env" >/dev/null
echo
echo "   Studio page user:      rexx"
echo "   Studio page password:  $P"
echo
echo "Write it down now. It is not stored anywhere readable."
unset P
