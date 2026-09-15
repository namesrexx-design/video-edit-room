# LYFE STUDIO CUT — GARAGE DREAM (EPISODE)

The local LYFE Studio source for the Garage Dream episode. Open `storyboard.html` for the visual storyboard library: Scenes, Characters, Sets, Props, and Script & audio. Select any card to inspect the reference and prepare an assignment, still edit, replacement, Higgsfield brief, lip-sync brief, or ElevenLabs brief.

- `storyboard.html` — the user-facing visual library and production-card workspace at `http://127.0.0.1:4321/storyboard.html`.
- `index.html` — the CapCut-style cut editor: play the cut, drag scenes, trim, park, save.
- `story.json` / `board.json` / `audio.json` — the current episode's scene, asset, script and audio records. `board.json` remains the source snapshot; card actions are saved as reversible browser-local preparation records until the coordinator approves a source change.
- `server.mjs` — local test server (`node server.mjs`, then http://localhost:4321). Needs `clips/` and `thumbs/` next to it (web proxies of the scene bin, not in git).

Saving in the cut editor writes `cuts/latest.json`. The visual library does not silently submit paid renders or rewrite the approved storyboard; it prepares a named action for the coordinator to review.

## storyboard-v2.html (Claude, 2026-09-15) — the owner's editing spec

Same data folder. `storyboard-v2.html` implements `SPEC-LYFE-STUDIO-EDITING.md`: tap a scene → one card with every
still (current, cut start/end, approved, candidates, archived), audio, editable script, cast, props, set + angle;
Characters, Sets and Props as movable / removable tiles (order saved); a Requests list (edit this, new still, what's wrong).
Open it at `http://127.0.0.1:4321/storyboard-v2.html`. Thumbnails are in `sb/` (not in git; rebuild with
`node tools/build-board.mjs` from the source of truth). `board.json` is format 2 and keeps a flat `objects` list for the
original page. The two pages are to be merged into one `storyboard.html`.
