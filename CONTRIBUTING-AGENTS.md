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
