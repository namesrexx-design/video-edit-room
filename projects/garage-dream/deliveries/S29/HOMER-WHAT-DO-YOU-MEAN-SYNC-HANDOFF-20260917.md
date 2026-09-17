# Pass 17 final owner correction — 2026-09-17

## Current owner decision
Rexx watched the rendered Pass 17 MP4 and accepted the film except Homer's lip alignment on “What do you mean?” Fix only that beat before the later crowd-audio pass. Preserve all other shots, speech, levels, timing and the 128-second duration. Do not reopen earlier candidate notes as new edit requirements.

## Render found
The server-rendered file is in Google Drive under Video 04 - Garage Dream - IN PRODUCTION / EDIT_ROOM:
PREVIEW-pass17-codex-2026-09-16.mp4
Drive search failed to return this file; direct listing of EDIT_ROOM found it. A GitHub draft and inability to reach the studio from another runtime did not establish that the server render was absent. The owner has now watched it.

## Exact edit
Base cut commit: 3b9d2d1f027ba284268415160b619cc5252c9038 (PR #21).
Picture block: sb_s29c / INV042.
Absolute picture range: [2899,2920) at 24 fps = 120.7916667–121.6666667 seconds; 21 frames.
Picture: inventory-v74/INV042_s29-v74-homer-whatdoyoumean-5f38-native-full16x9.mp4, source [0,21).
Audio block: S29-whatdoyoumean-sound, linked to sb_s29c, at=2899.
Audio: capcut-kit-v74/SCENES_IN_ORDER/24_S29_farewell-fist-bump.mp4, source [156,177), gain=-4.
The original INV042 inspected here is 1280x720, 24 fps, 21 picture frames. Its audio stream is digital silence; using it would remove the line. Preserve the accepted existing voice.

## Prepared input
EDIT_ROOM/Homer-What-Do-You-Mean-Sync-Input.mp4 is a 0.875-second excerpt from the accepted rendered Pass 17. This is INPUT ONLY, not the fixed result.
The user explicitly authorized sending this excerpt to Higgsfield for lip sync. Separate 21-frame picture and audio inputs were uploaded successfully and confirmed. No generation job has been submitted.

## Connector blocker
Sync Lipsync 3 (model sync_so) advertises input_video and input_audio media roles.
The tool schema accepts only canonical video and audio roles, but the backend rejects those with:
media role "video" not supported by Sync Lipsync 3. Allowed: [input_video, input_audio]
Supplying the advertised native roles fails tool input validation. A cost-only check using separate input fields also failed validation.
This is a connector incompatibility, not lack of owner approval. Do not claim the lips are fixed, a job is running, or a new MP4 has been rendered.

## Finish
Run actual lip sync on the prepared excerpt using the existing voice and targeting Homer only. Inspect mouth/phoneme alignment and preserve the other face, pointing hand, framing, and duration. Keep the canonical audio block unchanged and use the corrected picture for exactly 21 frames. Archive Pass 17 before a new cut. Render with the repository renderer on the studio server; deliver the newly named full MP4 and receipt to EDIT_ROOM. Confirm the exact file by direct folder listing, not search alone. Do not merge without Rexx.
