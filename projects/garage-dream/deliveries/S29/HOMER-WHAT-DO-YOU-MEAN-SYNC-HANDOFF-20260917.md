# S29 current status — continuous picture approved; lip sync unfinished

## Active directed edit — submitted after owner's go

- Seedance 2.5, video_edit mode, 1080p, one output.
- Job: baf1a5f2-3d93-4f9c-bdb6-45125e07b4ac.
- Input media: 69720276-104e-420b-80ad-ce41e569c18a, full-frame S29-continuous-review-SYNC-NOT-APPROVED.mp4 with the original dialogue already embedded. Upload confirmed.
- Preflight: 46.12 credits for the full 5.125-second source (earlier raw-source estimate was 45.37).
- Owner approved this first directed-edit test. A second take must follow inspection and a specific identified defect; no second take has been submitted.
- Prompt preserves the complete shot and identities, assigns Apu's question to 0.00–1.84s, Homer's reply to 2.36–2.74s, and the off-camera Rexx explanation to 3.20–4.64s; requests closed listener mouths and one small smooth Homer turn toward Rexx.
- This is a generative video edit, NOT a manual face-selection lipsync run. Exact synchronization remains to be checked in the returned export.
- Current status: in progress; no completed output or full-film update yet. Resume this job rather than submitting a duplicate.

## Current owner instructions (2026-09-17)

- Preserve the approved continuous Higgsfield shot. Do not crop the frame or revert to the rejected Pass 19 montage below.
- Apu speaks while pointing at Homer's forehead. Homer must be silent during Apu's line.
- Homer alone says “What do you mean?” with matching lips.
- During Rexx's explanation, Homer looks toward Rexx and both visible men remain silent.
- Use the existing Higgsfield and GitHub/server workflow. The separate Sync Studio login route was abandoned at the owner's correction; no media was uploaded there and no job was started there.

## Approved picture and available inputs

- Higgsfield Kling generation: c50ec25c-f761-4463-bc8b-558b71b6d73c.
- Raw file: S29-continuous-c50ec25c-raw.mp4 (1916×1080, 24 fps, 121 frames).
- Conformed review file: S29-continuous-review-SYNC-NOT-APPROVED.mp4 (1920×1080, 24 fps, 123 frames / 5.125 seconds).
- Original dialogue: S29-original-dialogue-123f.wav (48 kHz stereo, 5.125 seconds).
- The continuous review is in the existing EDIT_ROOM delivery location. Its filename deliberately marks sync as unapproved. It is not a finished film.

## Measured timing / remaining defect

Local speech recognition estimated the original Apu question at 0.00–1.84 s, Homer at 2.36–2.74 s, and Rexx at 3.20–4.64 s. The generated native soundtrack instead places Homer at 3.84–4.70 s. These are audio estimates, not proof of visual synchronization. Moving only Homer's original audio later would collide with Rexx's explanation and exceed the scene duration if the explanation were delayed as well. Do not drop dialogue or label such a shift finished.

Full-film replacement range remains [2843,2966) at 24 fps (118.458333–123.583333 s). No full film has been updated with the continuous take. Final duration and any timing changes require review; preserve the accepted master until the repair passes visual playback.

## Available tool findings

Higgsfield exposes Sync Lipsync 3 as model sync_so. It accepts video and audio references, with sync_mode options bounce, loop, cut_off, silence, remap. Its exposed schema has no speaker/face selector. Do not invent a face-selection parameter or claim a person was selected when only automatic detection ran. Higgsedit can move audio and compose frames; its inspected commands do not establish a generative lip-sync feature.

The checked video-edit-room main-branch connector implements convert_video, remove_background, and render_storyboard; no targeted lip-sync job is implemented there. The existing render-cut.mjs positions sound through a2.at and assembles the film. Generation and final rendering are separate steps.

No new lip-sync job was submitted in this continuation. Next operator must establish a supported full-frame speaker-targeting path, preserve the original dialogue, verify the resulting mouths during each speaker's line and silence, then deliver through the server pipeline with a receipt. Do not spend on a blind multi-face run under the claim of having selected Homer.

## Rejected history — retained only for traceability

The Pass 19 record below is superseded. Rexx rejected its discontinuous picture. Its old “ready for approval” statement is historical and must not be treated as the current status. Crowd audio comes after the S29 repair is approved.

---

# Pass 19 S29 dialogue-continuity correction — 2026-09-17

## Owner correction

Rexx watched Pass 17 and clarified the complete S29 problem:

1. During Apu's question, Homer's lips must not move.
2. Homer alone says “What do you mean?” with matching lips.
3. During Rexx's “blood on your forehead” explanation, both men stay silent and Homer looks toward Rexx/camera.

Preserve the accepted Pass 17 soundtrack, timing, and 128-second duration. Do not merge PR #21 until Rexx watches this revision.

## Delivered review files

Both files are in the existing Google Drive `EDIT_ROOM` folder:

- `PREVIEW-pass19-S29-dialogue-continuity-fixed-2026-09-17.mp4`
  - SHA-256: `e53b447533c15a514bbc1b3e2621e481197e0ddee39366d44ed9b05ca901a74b`
- `REVIEW-pass19-S29-dialogue-continuity-fixed-117.5-124.5.mp4`
  - SHA-256: `ff34b670ab7d70112077fffce8a9f7f496e38e62d1e886f82c090e63c82708c6`

## Exact picture replacements

The base is the accepted server-rendered `PREVIEW-pass17-codex-2026-09-16.mp4`.

| Absolute frames | Time at 24 fps | Result |
|---|---:|---|
| `[2843,2899)` | 118.458333–120.791667 s | Apu points while both mouths remain closed. |
| `[2899,2920)` | 120.791667–121.666667 s | Homer alone mouths “What do you mean?”, conformed to exactly 21 frames at 24 fps. |
| `[2920,2966)` | 121.666667–123.583333 s | Both mouths remain closed during Rexx's line; Homer looks toward Rexx/camera while Apu continues pointing. |

All other picture frames remain sourced from Pass 17. The full Pass 17 audio stream was copied unchanged.

## Validation

- Full duration: 128.000 seconds
- Picture: 1920×1080 H.264, yuv420p, 24 fps
- Exact video frames: 3,072
- Audio: AAC, 48 kHz stereo, 128.000 seconds
- Full decode: passed with no errors
- Pass 17 audio SHA-256: `28dcaa75a23275b482602a423978593871f069b19b2411d5a6646ae7c8a2f3f3`
- Pass 19 audio SHA-256: `28dcaa75a23275b482602a423978593871f069b19b2411d5a6646ae7c8a2f3f3`
- Audio is byte-for-byte unchanged.

## Status

Pass 19 is uploaded and ready for Rexx's visual approval. Crowd audio remains the next separate pass after approval.
