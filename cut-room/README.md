# Cut Room (browser editor, v2)

The CapCut-style page: play the cut, drag scenes, trim, park, save.
Live copies (private; share from the page Share menu): Cut Room https://claude.ai/artifact/6uQh9o2LcpjCorpXKfEi7e · Storyboard https://claude.ai/artifact/WPuCorxXtMZnNmvXbiLGTq · Codex original hub as-is https://claude.ai/artifact/VAeighuHjQjdsznJ3Vrxg8

- `index.html` — the page. Scene names and lines come from Codex's storyboard (`story.json`).
- `story.json` — extracted from `scene-board/storyboard.json` (id, title, line, status).
- `server.mjs` — local test server (`node server.mjs`, then http://localhost:4321). Needs `clips/` and `thumbs/` next to it (web proxies of the scene bin, not in git).

Saving writes `cuts/latest.json` into the artifact (files publish). Claude reads it, writes the
`.otio`, renders with `tools/render.mjs`. Audio lanes are not in this version yet — see the repo README.
