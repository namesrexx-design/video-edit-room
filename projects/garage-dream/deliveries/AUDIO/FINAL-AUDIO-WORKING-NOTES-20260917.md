# Final audio review delivery — 2026-09-17

## Current review copy
- Full film: GARAGE-DREAM-AUDIO-FINAL-REVIEW-20260917.mp4, EDIT_ROOM.
- Wake scene: S18-WAKE-AUDIO-REVIEW-20260917.mp4, EDIT_ROOM.
- Full film: 3070 frames, 24 fps, 1920x1080, 127.916667 seconds, 71,523,509 bytes.
- Full SHA256: 707C1350D05827BDF827E185DECDA34B10C1D635252DEF22CDBCC3999EE0BBA0.
- Wake SHA256: 2488401E3928173D84E7D4EF04261C7310A91AB21434054CF7B11E43107B1579.
- Review candidate, not owner-approved final master, live deployment, or PR merge.

## Requested additions completed using existing recordings
Owner clarified most recordings already exist. Reused AUDIO/S16-T2.mp3 (HOMER-EARLY-BUGATTI-WHISPER-V55), source frames [0,28), at frame1490 / 62.083333 s, gain +5dB. Whisper finishes before the existing first snore at exactly64 s.
Reused Bart AUDIO/AUD014.mp3, source frames [48,72), at frame2004 / 83.5 s, gain +7dB. This is his actual recorded laugh after the complete taunt, before the horn. Current Bart phrase kept and raised2dB; Apu/car segment [2033,2664) reduced1.5dB to soften the level jump.
Retained dream, mosquito, snore, horn, film length, framing, and approved S29 'Did I convert to Hindu?' whisper.

## Wake repair and remaining review issue
One Seedance2.5 video_edit take aff2103c-06a5-4a2a-9b57-fb1a97cf870c completed. Estimated45.37credits; no second take. Output is exactly121frames / 5.041667s, 1920x1080, silent HEVC. It replaces picture only at [1840,1961) / 76.666667–81.708333 s; the original dialogue remains.
Sampled visual review found consistent framing/identity with no crop or cuts. Mouth movement still anticipates the second sentence around79.7s, whose original audio begins about80.07s. Do not claim perfect sync or publication approval. Owner should review the attached5-second candidate; any further correction should target this exact line rather than regenerate the entire film.
Dedicated sync_so failed connector role/schema validation without a generation job or charge. Browser fallback was logged out. Supported video_edit worked.
One alternate new Bugatti TTS had started before the owner clarified recordings exist; it is unused and must not replace S16-T2.

## Verification
Canonical tools/render-cut.mjs rendered both committed cuts. Full decode/frame checks passed, 0 black intervals. Downloaded SHA256 matches renderer receipt.
Measured delivered film: -18.52 LUFS integrated, -2.11 dBTP, LRA6.60; no clipping detected. This is measured input, not loudnorm's hypothetical output.
Review used full decode, meters, transcription and sampled image inspection. It is not a calibrated continuous listening sign-off or assurance of every phoneme in every shot.

## Source recovery / reproduction
- Base film (3070f; SHA256 8BCE2D477DDF61A3A59B9E25D2326E2578AEFEC9EBF29070B9D2E3A54F0B2935): [Private media URL omitted; use the owner-accessible saved media.]
  Restore to projects/garage-dream/deliveries/FILM/GARAGE-DREAM-HOMER-WHISPER-20260917.mp4.
- New wake picture: [Private media URL omitted; use the owner-accessible saved media.]
  Restore to projects/garage-dream/deliveries/S18/S18-WAKE-PICTURE-REPAIR-aff2103c.mp4.
  SHA256 C06FCE7F30D399458C99916C25A892B40CB95D30ED730BEF91D32A42F46CFB83.
- S16-T2.mp3 and AUD014.mp3 remain in repository deliveries/AUDIO.
- Full uploaded render: [Private media URL omitted; use the owner-accessible saved media.]
- Wake with original audio: [Private media URL omitted; use the owner-accessible saved media.]
- Render receipts and exact cuts archive: [Private media URL omitted; use the owner-accessible saved media.]
- Cuts: projects/garage-dream/cuts/GARAGE-DREAM-AUDIO-FINAL-REVIEW-20260917.json and S18-WAKE-AUDIO-REVIEW-20260917.json.
- Run canonical node tools/render-cut.mjs with the cut path and a fresh output name; no large media committed.

## Next: crowd and effects
Cue plan FINAL-AUDIO-CUE-PLAN-20260917.json is saved. No new crowd mixed or generated. Existing supplied crowd sources were not located in repo/Drive searches. Keep existing effects and reuse supplied crowd recordings if located.
Largest audience reaction belongs after Blood and the upward look (~125.083s), with only brief optional earlier reactions. No greeting audience, constant crowd bed, covered dialogue, freeze, or ending extension.
Do not merge PR21 or promote a live cut without owner approval. Approved prior film remains recoverable.
