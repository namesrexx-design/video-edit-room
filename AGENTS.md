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
