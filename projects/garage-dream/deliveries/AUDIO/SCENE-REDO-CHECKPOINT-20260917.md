# Scene redo continuation — 2026-09-17

## Owner selection confirmed
Owner: “second one is the winner, now reassemble.” This approves S28 take2 job679e3bef-715d-4a23-8884-3739fa9036ba. Verified current full cut already uses that exact take in frames2667–2753 along with approved wake and Bart. Rechecked full MP4 SHA D218B655 against renderer receipt and confirmed saved complete72,074,577-byte file. Existing assembly fulfills the requested second-take selection; no duplicate render or generation needed. Full-film playback approval is separate from this scene approval.

## Latest completed delivery — all three fixes
GARAGE-DREAM-WAKE-BART-CAR-REVIEW-20260917.mp4 is the newest full review, superseding the wake/Bart-only review for playback.
3070frames,127.916667s,1920x1080,24fps,72,074,577bytes.
SHA256 D218B655197A9AE442FCE602856E251F94A552F7F7EB70642D55AB467B8C2AA0.
Higgsfield media e4184439-64e5-474e-a86e-30cb8f4d249c; owner chat libfile_b172a0140e2881919bdbabc6ab353227.
Standalone S28 review:86frames3.583333s,1,765,300bytes,SHA256 CA7AE17D8E7288C8EB6C61CDD34E9389EAE542790B3F5E083FCEABD404B1EB93; media cb7e7998-cfa2-4d84-ab0e-010957e4425d; chat libfile_7d81644473d48191be68c795041a62d1.
S28 source1916x1080 was padded2pixels each side to1920, never cropped. Used frames11–97 to trim excess lead-in while retaining one continuous motion. Inserted at exact existing slot2667–2753.
Full V2 audio is continuous and unchanged in timing/gain. Final measurement -18.48LUFS,-2.11dBTP,LRA6.2, no clipping. Measurements only; do not claim a human listening pass or perfect phoneme sync.
Canonical renderer full decode,3070-frame check and black scan passed. Download SHA256 independently matches renderer receipt. Initial large-file downloads were truncated; resumed both full files and verified hashes before final delivery. Earlier wake/Bart chat file replaced with corrected complete version1.
Cuts, receipts and generation history committed on continuation branch. No live promotion, merge, Drive copy or crowd mix.

## Approved wake and Bart replacements
Owner approved the second Bart take (b247db50-46f4-426e-aef9-fe941a568d19) and audio-driven wake take (8cb751f1-13c0-4574-a063-617a77d9d116).
First Bart redo1bb72f9d was rejected because Rexx turned; do not use it. Every frame of the second Bart take was inspected for that turn. It stays rear-facing. Review retains original V2 taunt and laughs, frames1961–2033.
Dedicated sync_so remains blocked by a connector schema mismatch: model wants input_video/input_audio, generic tool only accepts video/audio; direct top-level fields also failed cost validation. No sync_so job or charge occurred.
Connected Higgsfield generation DOES work. No browser login is required for that connector. Separate Apple browser sign-in was never verified. Automatic approval review rejected a later Apple-form recheck; no bypass was attempted.
Used supported Wan2.7 AUDIO-DRIVEN generation, not SyncLipsync3, with original wake starting image d1dd10ff-86f3-4282-af80-7c47aa2a339f and corrected V2 audio8b393c7e-4821-4d41-bf30-59b1b5f5e1d4. One5s take,12.5credit estimate. Generated audio cross-correlated with original WAV: zero lag,0.999419 correlation. Inspected30frame samples for restrained head movement and line/pause progression. This is not a certification of every phoneme. Owner then said “that works.”
Raw wake150frames30fps,5s conformed to24fps and padded one final frame to121frames5.041667s; full composition retained. Final assembly uses the ORIGINAL V2 audio, not generated audio.

## Completed full review before car replacement
GARAGE-DREAM-WAKE-BART-REVIEW-20260917.mp4:
3070frames,127.916667s,1920x1080,24fps,71,226,169bytes.
SHA256332FDB8BD3D03A3E30D56EF2D2071F501792FDC3E658190AE7C7E834918D5AD1.
Canonical render-cut.mjs passed frame count, full decode and black scan (zero).
Higgsfield media6b6a5afb-8365-4869-a996-0aa458564c5e; saved in owner chat libfile_4808f5bce9f08191b0a57acabe8d6e9d.
Standalone wake review media bab954c9-d2b4-4e67-8f56-cc7e69403d9b; libfile_e8ab861904848191a005e91699d5cb93.
Conformed wake source media447b911f-b0e0-48c7-8a60-40c68ae70ee4.
Approved Bart review media2e18d0ac-2c55-4281-928c-72b27cb78354; libfile_63118cbca9648191848212ec25a6ece9.
Full soundtrack retains three Bugatti whispers, first wake sentence at77s, beach line at80.13s, extra Bart exit laugh and closing Hindu whisper.
No live promotion or merge. Draft PR21 remains the continuation branch.

## S28 photo-reminder: now explicitly authorized
Old S28 is frames2667–2753 (111.125–114.708333s): existing silent listening/nodding clip c2c0e8d6, but both mostly looked at each other.
Owner asked if an unused toward-passenger take existed; none found in inspected history. Owner then explicitly said “then create one.”
New take1 job39003e7e-36f0-49c0-ba1a-9561fb636969,4s Kling3.0 pro/silent,6credit estimate, same original image22318fbe-fcbb-461b-bb86-f0cab565fab2.
REJECTED for Apu speaking/mouth flapping despite useful gaze turn. Not inserted.
Corrective take2 job679e3bef-715d-4a23-8884-3739fa9036ba COMPLETED and selected after visual review of24samples: quiet closed-mouth expressions and both shift gaze toward passenger camera. Removed spoken reminder text from prompt and required sealed motionless lips, silent attentive gaze toward passenger-seat camera.
Inserted and now owner-approved. Preserve full86frame slot and original Rexx audio. Do not confuse S28 with S29 later forehead/whisper scene.

## Delivery and next
Current approved full remains AUDIO-CORRECTIONS-V2 until owner accepts replacement full review. New wake/Bart full review is saved, not live.
Automatic review rejected prior Drive upload citing insufficient explicit destination authorization and unverified account ownership. New files delivered in chat instead. Do not claim new redo files are in Drive.
S28 take2 QC and full three-scene assembly are complete. S28 take2 is owner-approved; full-film playback review remains next. Crowd and effects mix remains future work.
