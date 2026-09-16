# START HERE: how your work goes live by itself (2026-09-16)

Rexx: "add it for them, that's why we keep making mistakes." You only need GitHub. The studio server does the rest.

| You do | What happens by itself |
|---|---|
| Open a PR from an `agent/<name>/...` branch that changes the cut | Within a few minutes the studio server renders a **preview** film from your branch and shows it on the storyboard page under "Waiting for Rexx", with a link to your PR |
| Rexx watches it and merges the PR (or anything lands on `main`) | Within about a minute the server pulls it and rebuilds the storyboard page |
| A change to `projects/garage-dream/cuts/STORYBOARD-FINAL.json` reaches `main` | The server also renders the live film, cuts the scene clips, copies the film to cloud storage and commits the receipt. The newest film plays at the top of the storyboard page |
| Upload media with the BizBox connector (below) | Within about a minute it is in the server's media folder `team`, ready for a cut |

## Media: never push big video into this public repo
Pushing media here makes your platform stop and ask Rexx. Instead use the **BizBox connector** (MCP over HTTP):
- Address: `https://mcp.biz-box.io/mcp`, header `Authorization: Bearer <key>`. The key is in your environment secrets as `BIZBOX_TEAM_KEY` (Rexx adds it; never print it, never commit it).
- Tools: `list_files`, `get_upload_link` (then HTTP PUT the file), `read_text_file`, `write_text_file`, `get_download_link`, `start_job` (`convert_video`, `remove_background`), `job_status`.
- Put Garage Dream media under `garage-dream/<scene>/<file>`, for example `garage-dream/S29/S29-bump-v4.mp4`.
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

# How every agent works in this repo without stepping on anyone

**Repo:** https://github.com/namesrexx-design/video-edit-room (public: anyone can read; writing needs Rexx's invite or a token he issues)

## The four rules

1. **Never work on `main` directly, and never edit another agent's working copy on the PC.**
   Make your own branch: `agent/<your-name>/<what>` (e.g. `agent/codex/storyboard-merge`). Push it. Open a pull request into `main`.
   `main` is protected: it only moves by pull request.
2. **Claim before you touch.** Add a line to `ACTIVE.md` (what you are editing, since when). Remove it when you stop. If a file is claimed, ask on Buzz `01-master-coordination` first.
3. **Commit small, commit often, name yourself.** `git -c user.name="<Agent>" commit`. One change per commit. Never `git add -A` (it drags in other people's work).
4. **Data is rebuilt, not hand-edited.** `board.json`, `story.json`, `audio.json`, `inventory.json` come from `tools/*.mjs` against the source of truth (`scene-board/storyboard.json` in the Codex workspace). Change the source or the tool, then rebuild.

## What you may change freely on your branch
- `cut-room/*.html`, `cut-room/*.css`, the pages
- `tools/*.mjs`
- docs (`README.md`, `SPEC-*.md`, `HANDOFF-*.md`)

## What needs Rexx's word in the PR before it merges
- Anything that deletes or renames media, timelines or receipts (rule: archive, never delete)
- Anything that changes the render pipeline's output (frames, sound) — attach the receipt
- Anything that spends money (Higgsfield, ElevenLabs) — the run itself needs his go in the moment

## Where the live copies are
- Cut Room (phone): https://claude.ai/artifact/6uQh9o2LcpjCorpXKfEi7e — private to Rexx
- Storyboard (phone): https://claude.ai/artifact/WPuCorxXtMZnNmvXbiLGTq — private to Rexx; his edits live in `state/edits.json` on that page
- Codex hub (PC only): http://127.0.0.1:4396/scene-board/index.html
Claude republishes the phone pages from `main` after a merge. Ask on Buzz if you need a republish.

## Getting write access (Rexx does this once per agent)
GitHub → repo → Settings → Collaborators → invite the agent's GitHub account, **or** Settings → Developer settings →
Fine-grained token scoped to this one repo, Contents: read/write, Pull requests: read/write. Hand the token to the agent
through its own secret store, never in chat, never in this repo.

## Media deliveries (2026-09-15)
Finished scene media goes ONLY under `projects/<project>/deliveries/<scene>/` — the one folder git accepts .mp4/.wav in. Direct pushes to main are allowed; force-push/deletion blocked.

## Storyboard source — ONE copy, in this repo (2026-09-16, owner: "all the work stays in GitHub")

| File | What it is |
|---|---|
| `projects/garage-dream/source/storyboard.json` | **The** storyboard: every scene, line, clip choice, approval, archive |
| `projects/garage-dream/source/reference-lock.json` | Character / set / prop reference locks |

- **Cloud agents (Codex/Astra, Claude on the web): edit these two files and open a PR.** Do not edit the BizBox copy (`bizbox: docs/video-production/scene-board/storyboard.json` on `codex/video-storyboard-reference-hub`); that copy is retired and no longer feeds the page.
- The PC keeps a working copy in `Documents\Codex\...\scene-board\` because older PC tools write there. `tools/source-sync.mjs` (run automatically by `tools/build-board.mjs`) keeps both equal: newer file wins, the other is backed up to `source/_backups/` (local, not committed). Never both-edit in the same minute.
- The owner's live choices on the page (removed / rejected / chosen / added tiles) are at `https://app.biz-box.io/api/functions/boardState?page=garage-dream`. Read them before choosing takes.
- Finished media: `projects/garage-dream/deliveries/<SCENE>/<SCENE>-COMPLETE-<what>.mp4` with sound, + `SHA256SUMS.txt`. Files over 100 MB cannot go to GitHub; give the Higgsfield job id instead.
- Owned by Claude (PC), do not edit: `cut-room/storyboard-v2.html`, `cut-room/board.json`, `projects/garage-dream/cuts/STORYBOARD-FINAL.json`, `tools/render-cut.mjs`.
