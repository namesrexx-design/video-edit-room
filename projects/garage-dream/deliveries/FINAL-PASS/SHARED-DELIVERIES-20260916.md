# Actual owner-pass scene deliveries

These assets were generated through the connected Higgsfield and ElevenLabs accounts, then assembled in Astra’s local checkout. They had NOT previously been pushed to the shared repository or deployed to the Hetzner/R2 workspace. This PR closes that asset-delivery gap. It does not replace the live film or approve the disputed v6 review.

| Piece | File | Source / status |
|---|---|---|
| Homer turns toward Rexx, outside Apu’s car | ../S27/S27-COMPLETE-homer-two-months-timed-voice-v1.mp4 | New established Garage Dad recording: “Yeah, he opened it two months ago.” Existing INV051 picture retimed 48→52 frames. Fresh Sync 3 was blocked, NOT completed. |
| Quiet listening and nodding | ../S28/S28-COMPLETE-closed-mouth-nodding-v2.mp4 | Kling 2789fb1b-6612-4d8f-b14f-0b2417bf61bc; original Rexx photo-reminder audio included; 86 frames. |
| One fist bump | ../S29/S29-COMPLETE-single-bump-clean-handoff-v3.mp4 | Kling ad76affe-cb9e-4f93-b360-66878ee5f18e; 51 selected frames; intentional silent gesture, AAC track included. |
| Silent reaction during Rexx’s forehead explanation | ../S29/S29-COMPLETE-silent-listeners-with-rexx-line-v2.mp4 | Kling 924976ae-5fdd-4c55-9b43-7ad508ed34eb; unchanged Rexx audio included; 46 frames. |

Both generated keyframe PNGs, the new Homer MP3, render receipts and SHA256SUMS.txt are included. These are candidate deliveries awaiting owner playback/continuity approval. Integrate them into the current shared source/cut; do not use an older full film as authority.

The actual local v6 master AND its linked 720p file were checked against the new Homer recording at 99.625–101.625 seconds: waveform correlations were 0.999983 and 0.999981. Thus those local files contain the new recording. What the owner’s player served has not been established. The shared page/server was not updated by Astra, and no claim is made that it contains these assets.

Three Kling motion jobs cost 15 credits total; ElevenLabs voice generation DrKh7cIGsj7T2ZeWpEMm cost 50.9949 ElevenLabs credits. No additional generation charge for this delivery. Latest owner corrections still include audience at 32–33s, snore onset exactly64s, and ending/take continuity. Two isolated local audio checks exist; no replacement full film is claimed.

Claude retains the live film/page. Protected cut-room/storyboard-v2.html, cut-room/board.json, projects/garage-dream/cuts/STORYBOARD-FINAL.json and tools/render-cut.mjs are untouched. This runtime has no configured server SSH identity or R2 credentials; GitHub connector access works, direct CLI pushes lack authentication. Server deployment remains separate and unverified.
