---
name: server-first
description: Where ALL BizBox / LYFE work lives and runs — GitHub for code, our own Hetzner server (lyfe-studio) for everything that runs. Use before building or changing ANY page, function, database record, job, or media tool; before touching Base44; and whenever someone says "publish", "deploy", "carry", "sync" or "go live". Base44 is being retired.
---

# Server first: GitHub + our server. Base44 is being retired.

**Rexx, 2026-09-16:** *"Everything is done in GitHub. Base44, they're going to charge us. GitHub is free and our server, we already paid for it. We should be using that so other agents can see the work there."* Then: *"have this as a solid skill that all work is done on our server."*

## The rule

| Where | What lives there |
|---|---|
| **GitHub** (`namesrexx-design/*`) | ALL code, content, schemas, docs. Every change lands here FIRST, in a commit other agents can read |
| **Our server** (Hetzner `lyfe-studio`, reached as `studio.biz-box.io` / `mcp.biz-box.io`, never an IP in anything a member sees) | EVERYTHING that runs: website, API/functions, database, logins, jobs, media tools, connector, storyboard, renders |
| **Cloudflare R2** (`lyfe-studio` bucket) | Media files (members under `tenants/<slug>/`) |
| **Base44** | LEGACY. Still serves biz-box.io until the switch-over. No new feature may exist ONLY in Base44 |

## Before you build anything

1. Write it in GitHub (explicit `git add <paths>`, never `-A`).
2. Build it to run on **our server**: a service in `video-edit-room/deploy/docker-compose.yml` (or the BizBox server stack once it exists), behind Caddy, data in our database / R2.
3. Do **not** create new Base44 entities, functions or workflows for new work. If something must keep working on the live site before the switch-over, the Base44 copy is a **mirror** of the GitHub files (carry with `git checkout FETCH_HEAD -- <paths>`), never the original.
4. Never put secrets in GitHub or chat. Server secrets live in `/srv/lyfe/**/.env` (root-only). Rexx pastes keys himself.
5. Deliverables for Rexx still go to Drive as PDFs (see CLAUDE.md §1).

## How work goes live on our server

- `video-edit-room` → server auto-syncs `main` every 60 s (pull, rebuild page, render if the cut changed, reload its own code). Agent branches `agent/*` get preview renders under "Waiting for Rexx".
- Containers: `cd /srv/lyfe/repo/deploy && docker compose up -d --build <service>`; after changing a long-running service's code, **restart that service** (the connector kept old code for 4 hours on 2026-09-16 until restarted).
- Check it answers from outside before saying it works (`curl -sI https://<name>.biz-box.io/...`). A DNS name that does not resolve means the IONOS record is missing (Rexx's click), not that the service is down.

## Moving BizBox off Base44 (the plan, in order)

| Step | What | Status |
|---|---|---|
| 1 | Server stack for BizBox: Postgres, API service (the ~40 `base44/functions/*` ported from Deno `Deno.serve` + Base44 SDK to plain handlers on our DB), static site from `vite build`, Caddy | not started |
| 2 | Logins: our own auth (email magic link / Google), roles `admin` / member | not started |
| 3 | Schemas: every `base44/entities/*.jsonc` → a Postgres table, keeping the RLS intent (owner/admin rules) in the API | not started |
| 4 | Test address (e.g. `next.biz-box.io`), every page and payment checked there | not started |
| 5 | Copy all Base44 records (leads, orders, customers, members, workspaces, studios, bookings) into Postgres; re-run to catch late rows | not started |
| 6 | PayPal webhook URL + DNS for `biz-box.io` → our server (Rexx's clicks), then Base44 down to its lowest plan, then cancel | not started |

Update this table as steps finish. Until step 6, the live site is still Base44 — say so plainly when reporting.

## Server facts (check before trusting)

- `ssh -i ~/.ssh/lyfe_studio_ed25519 root@2.28.123.22` (the IP is for us only). CPX32: 4 cores, 8 GB RAM, 150 GB disk, no GPU.
- Code at `/srv/lyfe/repo`, media at `/srv/lyfe/media`, connector at `/srv/lyfe/connector`, editor output at `/srv/lyfe/editor`.
- Running: `deploy-studio-1` (:8787), `deploy-web-1` (Caddy), `deploy-connector-1` (:8790).
- Heavy stacks (Chatwoot, Dittofeed) may need a second server — ask Rexx before buying anything.

## Never

- Never build a new feature only inside Base44.
- Never say "published" when only GitHub changed; say where it runs.
- Never call Base44 `/deploy` or click Publish — that is Rexx's click while Base44 is still live.
- Never delete; archive or rename.
