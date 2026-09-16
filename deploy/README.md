# LYFE Studio shared server

One cloud machine every agent works on, so nothing depends on Rexx's PC being on.

| Piece | Holds |
|---|---|
| GitHub (this repo) | storyboard source, cuts, tools, finished deliveries |
| Cloudflare R2 bucket `lyfe-studio` | working media (`media/`), Codex's workspace (`codex-workspace/`), the built page (`editor/`) |
| Hetzner server (Docker) | `studio` container (node, ffmpeg, rclone, Blender headless) + `web` (Caddy, HTTPS, password) |

## Setup, in order

**1. Rexx: Cloudflare R2 key.** Cloudflare dashboard → R2 → *Manage API tokens* → *Create API token* → permission *Object Read & Write*, bucket `lyfe-studio` → Create. Keep that page open: it shows the **Access Key ID**, **Secret Access Key** and the **endpoint**.

**2. PC: fill `deploy/.env`** (copy `.env.example`; the file is git-ignored). Then upload the media once:

```bash
bash deploy/media-push.sh          # dry run
bash deploy/media-push.sh --go     # upload (~20 GB, copy only)
```

**3. Rexx: Hetzner server.** New project → Add server → Location near you → Image **Ubuntu 24.04** → Type **CPX31** (4 vCPU / 8 GB / 160 GB) → add your SSH key or use the emailed root password → Create. Send the server's **IP address**.

**4. Server: bootstrap** (as root):

```bash
curl -fsSL https://raw.githubusercontent.com/namesrexx-design/video-edit-room/main/deploy/bootstrap.sh | bash
```

Copy the same `.env` to `/srv/lyfe/repo/deploy/.env`, add a password hash (`docker run --rm caddy:2 caddy hash-password --plaintext '…'`) and a GitHub token, then:

```bash
bash /srv/lyfe/repo/deploy/up.sh
```

The storyboard is then at `http://<server IP>/` (user `rexx`). Point a domain (e.g. `studio.biz-box.io`) at the IP and set `STUDIO_DOMAIN` for HTTPS.

## Daily use

```bash
ssh root@<IP>
cd /srv/lyfe/repo/deploy
docker compose exec studio bash                          # the shared workspace
node tools/render-cut.mjs projects/garage-dream/cuts/STORYBOARD-FINAL.json NAME
node tools/build-board.mjs
blender -b file.blend -P script.py
bash /srv/lyfe/repo/deploy/up.sh                          # pull latest repo + media, rebuild page
```

Same code runs on the PC unchanged: `tools/paths.mjs` defaults to the PC folders when no environment variable is set.

## Not on the server

DaVinci Resolve, CapCut and After Effects need a screen; they stay on a desktop. After Effects is not installed on the PC.
