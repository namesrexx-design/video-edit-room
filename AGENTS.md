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
