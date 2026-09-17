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
