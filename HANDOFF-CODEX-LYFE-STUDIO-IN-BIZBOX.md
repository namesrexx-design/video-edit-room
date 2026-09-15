# Handoff: LYFE Studio into BizBox

**Owner's ask (Rexx, 2026-09-15):** LYFE Studio has to live inside BizBox, where any user can open it
and: select a scene, a character or an object and say "edit this"; go to a scene on the storyboard or
the script and rewrite the script; create a still. All of it inside LYFE Studio.

This document is what exists today, the data contracts, and what the BizBox build needs.
Codex owns the BizBox implementation; Claude built the prototype and the render tools.

## What exists (prototype, all in this repo)

| Piece | Where | State |
|---|---|---|
| Cut Room (timeline editor) | `cut-room/index.html` | Working. Main video, script, scene sound, added sound, 2nd video lanes; inventory shelves for video and sound; drag, trim, split, replace, take out, unlink; save |
| Storyboard (view layer) | `cut-room/storyboard.html` + `board.json` | Working. 35 scenes, 4 characters with 61 references, 18 sets/objects, file dates, older-than-cut flags |
| Live pages (private artifacts) | Cut Room `https://claude.ai/artifact/6uQh9o2LcpjCorpXKfEi7e` · Storyboard `https://claude.ai/artifact/WPuCorxXtMZnNmvXbiLGTq` · Codex hub as-is `https://claude.ai/artifact/VAeighuHjQjdsznJ3Vrxg8` | Prototype hosting only; BizBox replaces this |
| Renderer | `tools/render-cut.mjs` (format-2 saves), `tools/render.mjs` (OTIO) | Proven: frame-exact, cutaways, mixed sound, receipts |
| Media conform | `tools/build-inventory.mjs`, `tools/build-audio-bin.mjs` | Conforms any clip to 1080p24 + web proxies |
| Storyboard data | `tools/build-board.mjs`, `tools/refresh-storyboard-stills-v74.mjs`, `tools/register-v74-on-storyboard.mjs` | Read/write against the source of truth with backups |

## Source of truth

`scene-board/storyboard.json` in the Codex project folder, regenerated into `board-data.js`. Edits go there.
LYFE Studio's storyboard is rebuilt from it and never writes back (see `AGENTS.md`).
In BizBox this becomes entities; storyboard.json stays the export/import format until then.

## Data contracts already in use

**Cut save (format 2)** — what the Cut Room writes, what `render-cut.mjs` reads:
```json
{ "format": 2, "fps": 24,
  "v1": [ { "id": "01", "file": "01_S01_stairs.mp4", "folder": "capcut-kit-v74/SCENES_IN_ORDER", "start": 0, "end": 79, "mute": true, "u": "k3x9a" } ],
  "a1": [ { "id": "01", "file": "…", "folder": "…", "start": 0, "end": 79, "at": 0, "link": "k3x9a", "off": 0 } ],
  "a2": [ { "id": "AUD001", "file": "…", "folder": "audio-bin-v74", "start": 0, "end": 1562, "at": 240 } ],
  "v2": [ { "id": "INV003", "file": "…", "folder": "inventory-v74", "start": 0, "end": 120, "at": 720 } ],
  "parked": [ { "id": "18", "file": "…" } ] }
```
Frames at 24 fps. `v1` is sequential (pictures, silent). `a1` is each scene's own sound, linked to a picture by `u`.
`a2`/`v2` sit at absolute frames. Overlaps are allowed on sound.

**Board (`board.json`)** — scenes `{id,title,line,status,still,stillDate,stillStale,v74:{start,end}}`,
characters `{name,status,voice,continuity,refs:[{id,title,role,notes,approved,status,group,img,date}]}`,
objects `{title,role,status,img,date,approved}`.

**Media** — never in git. `MEDIA-MANIFEST.json`, `INVENTORY-MANIFEST.json`, `AUDIO-MANIFEST.json` carry
path, sha256, frames. In BizBox: upload to storage, keep the same manifest fields.

## What BizBox needs to add (the owner's list)

1. **Select and request.** On any scene, character or object: an "Edit this" action that opens a request
   (what to change, reference image, notes). Creates a `StudioRequest` (project, targetType, targetId, ask, status).
2. **Rewrite the script.** Scene line is editable in place; history kept (`imageHistory` pattern already used
   for stills — do the same for `lineHistory`). Changing a line flags the scene's voice take and lip-sync as stale.
3. **Create a still.** From a scene or character: generate (Higgsfield, `generate_image_batch`) using the
   approved references as inputs; result lands as a candidate with a date; owner approves; approval updates the
   scene's `image`. AI images labeled "visualization" until approved.
4. **Cut Room inside BizBox.** Same page, same save format; "Save" writes the cut entity; "Render" queues
   `render-cut.mjs` on the render box (this PC or a worker) and returns the MP4 + receipt.
5. **Dates everywhere.** Every still, reference, take and render shows its date and is flagged when older than the
   project's current base cut.

Suggested entities: `StudioProject`, `Scene`, `Character`, `SceneObject`, `Reference` (image/audio, approved, date),
`Cut` (format-2 JSON), `Render` (receipt), `StudioRequest`.

## Rules that carry over

Never delete (archive). Never overwrite a render. Pictures and sound are separate blocks. Owner approval is the
only thing that makes a reference render-eligible. His name is Rexx.

## Target architecture (Codex, 2026-09-15) — agreed

```
Phone/Desktop Cutline UI
        ↓
BizBox project and agent coordinator
        ↓
GitHub: storyboard, references, prompts, approvals, receipts
        ↓
Remote agents: stills, video, lip-sync, audio, QC
        ↓
Cloud media storage: videos, images, audio, renders
```

"Cutline" = the mobile editor (today's Cut Room). LYFE Studio = the product. BizBox = the control center.
`localhost:4321` was only Claude's local test server for the prototype; it is not a surface anyone should use.

| Step | State today | Owner |
|---|---|---|
| 1. V74 as the single active project manifest | Done at the source: `storyboard.json` currentFullCut/currentAssembly/restartCheckpoint = V74; 27 scenes carry V74 ranges; stills refreshed from V74 (2026-09-15). Needs a top-level `activeProject` block that every surface reads first | Codex |
| 2. Version guard so stale snapshots cannot load | Not built. Proposal: every page/agent reads `activeProject.version` + `sha256` and refuses to act on anything else; LYFE pages show the version they were built from | Codex |
| 3. Live Studio → Cutline mobile editor | Prototype done (`cut-room/index.html`, format-2 saves). Needs: project/version picker, request/approve flows, references upload | Codex, Claude assists |
| 4. GitHub through a secure backend | Not built. Records (storyboard, cuts, receipts, approvals) commit to GitHub from a backend, never from the phone | Codex |
| 5. Encrypted, user-scoped agent connections | Not built. Per-user keys (Higgsfield, ElevenLabs), never in the repo | Codex |
| 6. Media in cloud storage, records in GitHub | Half: manifests with sha256 exist; media is on D: + Drive. Needs cloud bucket + the same manifest fields | Codex |
| 7. Approval gates for paid renders, publishing, public social changes | Rule exists (owner approval only). Needs enforcement in the coordinator | Codex |

Render tools in this repo (`tools/render-cut.mjs`, `render.mjs`) become the remote "video" agent's job: same inputs, same receipts.
