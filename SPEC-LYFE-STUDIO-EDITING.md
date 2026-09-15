# LYFE Studio — editing spec (Rexx, 2026-09-15, verbatim intent)

Shared with Codex (building the BizBox Live Studio module) and Claude. This is what the owner wants to be
able to do. Both builds implement against THIS, not their own reading of it.

## 1. Scene card — "click scene 9, boom, everything in it opens"

Clicking a scene opens one card holding everything that belongs to that scene:

| Inside the card | Detail |
|---|---|
| Still images | ALL stills for the scene. If the shot is start-frame + end-frame, both are shown as a pair. If it is a multi-motion (multi-frame) shot, every frame is shown in order |
| Audio | Every audio record: voice takes, lip-sync audio, SFX, music cue, with dates |
| Script | The scene's line(s), editable in place |
| Characters | Who is in the scene, linked to their character records |
| Props | Every prop used in the scene |
| Set | The set (location) and which camera angle of that set |

Actions on the card: **edit**, **swap** (replace a still, take, or clip with another), **have ChatGPT create a new
still** (a new start/end pair or a new frame), **mark what is wrong** (owner roughs up / annotates what is off, e.g.
"the character is off", and the agent fixes exactly that), **approve / reject** candidates.

## 2. Character section — editable, movable, removable tiles

- Each character has tiles for each reference: full body, rear/behind, left side, right side, head sheet, outfits, dream look.
- Click a tile → edit that reference (regenerate with a note, replace, annotate what is wrong).
- Remove tiles the owner doesn't want. Nothing deleted: removed = archived with date.
- **Tiles are movable.** The owner drags them into the order he wants ("these ones here, these ones here"). Order is saved.
- Example given: "Rexx approved full body" — open it, edit it; edit the behind view; edit the left side and right side views.

## 3. Sets and Props are SEPARATE sections

**Set** = a location. Each set has its own camera angles as tiles under it.
Sets named by the owner:

| Set | Notes |
|---|---|
| Stairs | opening |
| Coffee | kitchen counter scene |
| Outside balcony | |
| Upstairs balcony | |
| Waymo | car interior + boarding angles |
| Driveway | |
| Garage | many angles (master set, reveal, recliner, treadmill...) |
| Car (Apu's Firebird) | passenger seat, driver, rear approach angles |
| Vintage Mart | future episodes |

**Prop** = anything that gets moved, touched, or moves in the scene (phone, coffee mug, slingshot, boxes, consoles,
recliner is set dressing unless moved, mosquito, skateboard, Happy Gas tank, etc.).

Both sections use the same movable, editable, removable tiles as characters. Owner organizes them by dragging.

## 4. General rules

- Everything shows its date; anything older than the active base cut is flagged.
- Nothing is deleted; remove = archive with date.
- Owner approval is the only thing that makes a reference render-eligible; AI images say "visualization" until approved.
- Every edit is a request the agent fulfils and returns as a candidate; the owner approves; the record (storyboard.json →
  BizBox entities) updates only on approval.
- Paid renders (Higgsfield, ElevenLabs) need the owner's explicit go in the current session.

## 5. Data needed that we do not fully have yet

- Per-scene lists of characters, props and set/angle (storyboard.json has scenes and references but not a per-scene
  cast/prop/set link for every scene). First pass: derive from scene titles + lines + the garage prop inventory, then the
  owner corrects on the cards.
- Start/end/multi-frame grouping per scene: exists in the worker folders (START/END frame files) but not indexed. Index them.
- Tile order per user: new field (`order`) on references, sets, props.
