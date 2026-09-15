# LYFE STUDIO CUT — GARAGE DREAM (EPISODE)

The local LYFE Studio source for the Garage Dream episode. Open `storyboard.html` for the visual storyboard library: Scenes, Characters, Sets, Props, and Script & audio. Select any card to inspect the reference and prepare an assignment, still edit, replacement, Higgsfield brief, lip-sync brief, or ElevenLabs brief.

- `storyboard.html` — the user-facing visual library and production-card workspace at `http://127.0.0.1:4321/storyboard.html`.
- `index.html` — the CapCut-style cut editor: play the cut, drag scenes, trim, park, save.
- `story.json` / `board.json` / `audio.json` — the current episode's scene, asset, script and audio records. `board.json` remains the source snapshot; card actions are saved as reversible browser-local preparation records until the coordinator approves a source change.
- `server.mjs` — local test server (`node server.mjs`, then http://localhost:4321). Needs `clips/` and `thumbs/` next to it (web proxies of the scene bin, not in git).

Saving in the cut editor writes `cuts/latest.json`. The visual library does not silently submit paid renders or rewrite the approved storyboard; it prepares a named action for the coordinator to review.
