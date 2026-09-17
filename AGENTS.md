# START HERE: how your work goes live by itself (2026-09-16)

## 🔴 READ [ONE-COPY.md](ONE-COPY.md) FIRST — Rexx, 2026-09-17

*"Everybody's working on the same thing, but they're all working on a different
same thing. There should be just one copy that everybody works on of everything
we do."*

One cut, one master, one board, one queue. A new version replaces the old in
place; the old goes to . **If it is not on the server it does not
exist** — check with , which reports what the
machine actually has, and hand over big files with
.
This rule exists because ignoring it cost a full day on 2026-09-17.


Rexx: "add it for them, that's why we keep making mistakes." You only need GitHub. The studio server does the rest.

| You do | What happens by itself |
|---|---|
| Open a PR from an `agent/<name>/...` branch that changes the cut | Within a few minutes the studio server renders a **preview** film from your branch and shows it on the storyboard page under "Waiting for Rexx", with a link to your PR |
| Rexx watches it and merges the PR (or anything lands on `main`) | Within about a minute the server pulls it and rebuilds the storyboard page |
| A change to `projects/garage-dream/cuts/STORYBOARD-FINAL.json` reaches `main` | The server also renders the live film, cuts the scene clips, copies the film to cloud storage and commits the receipt. The newest film plays at the top of the storyboard page |
| Upload media with the BizBox connector (below) | Within about a minute it is in the server's media folder `team`, ready for a cut |

## 0. 🔴 All work is done on our server (Rexx, 2026-09-16)

- **GitHub** holds every change first. **Our Hetzner server** runs everything (website, API, database, logins, jobs, media tools). Media goes to Cloudflare R2.
- **Base44 is being retired.** Do not create new Base44 entities, functions or workflows for new work. Until the switch-over, Base44 only mirrors files from this repo.
- Secrets never go in the repo or chat; server secrets live in root-only `.env` files on the server.
- Full rule and the move-off-Base44 plan: `.claude/skills/server-first/SKILL.md` in the Claude Code Build workspace (mirrored in `docs/SERVER-FIRST.md` here).

## Media: never push big video into this public repo
Pushing media here makes your platform stop and ask Rexx. Instead use the **BizBox connector** (MCP over HTTP):
- Address: `https://mcp.biz-box.io/mcp`, header `Authorization: Bearer <key>`. The key is in your environment secrets as `BIZBOX_TEAM_KEY` (Rexx adds it; never print it, never commit it).
- Tools: `list_files`, `get_upload_link` (then HTTP PUT the file), `read_text_file`, `write_text_file`, `get_download_link`, `start_job` (`convert_video`, `remove_background`), `job_status`.
- Put Garage Dream media under `garage-dream/<scene>/<file>`, for example `garage-dream/S29/S29-bump-v4.mp4`.
- Merch renders (hats, mugs, shirts, shirt designs) go under `garage-dream/merch/<group>/` with group = `hats`, `mugs`, `shirts` or `shirt-designs`. They show in the storyboard Merch tab within about a minute.
- In a cut, point a block at it with `"folder": "team"` and `"file": "garage-dream/S29/S29-bump-v4.mp4"`.
- Small receipts and notes can still go in `projects/garage-dream/deliveries/`; cuts can read those with `"folder": "repo-deliveries"` and a `file` path relative to that folder.

## Cut rules that keep the film right
- Every picture block in `v1` has `u` (unique id), `scene`, `file`, `folder`, `start`, `end` (frames at 24 fps), `mute: true`.
- Sound goes in `a2` with `link` = the `u` of its picture block and `at` = the frame where it starts. Keep sound linked so it moves with the picture.
- Before you change the cut, copy the current one to `STORYBOARD-FINAL-passNN.json` (never delete old passes).
- Check your cut plays: `node tools/render-cut.mjs projects/garage-dream/cuts/STORYBOARD-FINAL.json CHECK-<name>` on the server is what the robot runs; a failed render leaves the last good film in place and writes `FAILED:` in the job log.

## Files you never hand-edit
`cut-room/board.json`, `projects/garage-dream/STORYBOARD-BOARD.json` (rebuilt every time), `deploy/` (the server itself). Every PR is merged by a person (Rexx); your job is to make the preview good enough that he can merge it after one watch.

This section replaces any older rule below that says otherwise (for example "media never enters git" or "render only with tools/render.mjs": the live renderer is now `tools/render-cut.mjs`, run by the server).


---

# For every agent (Claude, Codex, Buzz workers) touching a video here

1. **Read the timeline, not the last render.** `projects/<video>/timelines/` is the truth.
   The newest mp4 is only what the newest timeline rendered to.
2. **To change a cut: copy the latest `.otio` to a new name, edit the JSON, render it.**
   One change per new timeline. Never edit a timeline that has a receipt.
3. **Render only with `node tools/render.mjs`.** No ad-hoc ffmpeg assemblies, no Python
   one-offs. If the renderer can't do something (a transition, a second audio track), add it
   to the renderer and commit the change; do not work around it.
4. **Media never enters git.** Put new clips next to the others on D:, mirror to Drive, add
   them to `MEDIA-MANIFEST.json` with sha256 and frame count.
5. **Never overwrite, never delete.** The renderer refuses to overwrite. Superseded work goes
   to `_superseded/`.
6. **Say what you did with the receipt.** Every render writes `renders/RECEIPTS/<name>.receipt.json`.
   Quote its frame count and sha when reporting.
7. **The owner may edit in DaVinci Resolve and export a new `.otio`.** Treat that file as an
   owner decision: render it as-is, report anything the renderer ignored (warnings in the
   receipt), do not "fix" his cut.
8. **His name is Rexx**, spelled R-E-X-X, never Rex.

## Storyboard: one source of truth (2026-09-15)

- **Source of truth:** `C:\Users\16263\Documents\Codex\2026-09-04\referenced-chatgpt-conversation-this-is-an-2\scene-board\storyboard.json`. Edit scenes, approvals, references THERE.
- **After any edit:** regenerate `scene-board/board-data.js` (`window.REXX_BOARD = <json>;`). Back up both files first (`*.bak-<stamp>`), never overwrite without a backup.
- **BizBox main storyboard (authoritative view, has the edit/save controls):** `http://127.0.0.1:4396/scene-board/index.html?version=v74#latest-working-edit` (Codex's local server on this PC).
- **LYFE Studio Storyboard is a VIEW layer only.** It is rebuilt from that source with `node tools/build-board.mjs` (writes `board.json` + `sb/*.jpg`), then republished. It never writes back.
- Every still and reference on the LYFE view shows its file date and is flagged when older than the current base cut (`V74_DATE` in `tools/build-board.mjs`). Bump that date when the base cut changes.
