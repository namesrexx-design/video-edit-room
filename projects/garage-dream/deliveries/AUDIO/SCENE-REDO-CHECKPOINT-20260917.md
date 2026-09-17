# Scene redo continuation — 2026-09-17

Owner asked to redo Homer wake with dedicated lip-sync, copy/re-render original Bart, and check whether the photo-reminder scene shows both men looking at Rexx. Owner then asked to refresh screen and start over; browser was refreshed, current approved V2 master preserved.

## Bart completed for review
Original generation located in regular Higgsfield history:289b1632-be3b-43e4-b884-4b42200078e1,Kling3.0,5seconds. Starting image6b95ab77-43bd-4160-8686-c85e8c7d294d.
Copied that original starting reference and revised its prompt for the current3second scene slot: complete taunt, one coherent push, two short laughs while rolling toward lower-right. One take submitted,estimated4.5credits.
New job1bb72f9d-02cf-4f2b-bb34-8bc26815dcab completed1920x1080,24fps,73frames,silent. Review uses first72frames with original V2 audio[1961,2033),preserving dialogue and laughs.
S19-BART-REDO-REVIEW-20260917.mp4:72frames,3s,2,108,212bytes,SHA256 9ABD71546B1583319DAF0C4C40CD1D136B508A482FF1DEDF2DDC532A9C912ADB.
Inspected9frames across the new take; coherent push/exit progression, no gross framing or identity break seen. This does not certify phoneme-level lip sync. Full canonical renderer decode and black scan passed. Cut and receipt committed. Review and raw saved in owner chat. Not yet swapped into full film.
Drive upload was rejected by automatic approval review citing insufficient explicit file/destination authorization and unverified Drive ownership. No workaround upload attempted.

## Dedicated wake lip-sync still incomplete
sync_so model still requires input_video/input_audio while connector params.medias schema only allows canonical video/audio. Read-only estimate returned INVALID_ARGUMENT before any job. No sync_so charge/job.
Browser refreshed as owner requested. Higgsfield still showed Login. Secure browserAuth offered visible methods; owner chose Apple, then took manual control at Apple's credential form. Subsequent visible state remained Apple sign-in. No successful Higgsfield sign-in verified; never claim lip-sync complete.
Current correct input is the V2 wake shot[1840,1961),121frames,5.041667seconds with FIRST sentence moved to77seconds and beach timing unchanged. Do not reuse the earlier delayed audio.
Prepared local saved files: S18-WAKE-V2-LIPSYNC-INPUT.mp4 and S18-WAKE-V2-LIPSYNC-AUDIO.wav.
Uploaded current video media2db00ec2-b176-47b9-bc13-32dbd7727ccf; matching MP3 media8b393c7e-4821-4d41-bf30-59b1b5f5e1d4. Both confirmed. SourcefullV2 media98987112-7c58-46a6-96d1-db076c5d5bb0.
When browser sign-in succeeds, inspect supported dedicated lip-sync UI/controls; preserve full frame, original audio and5.041667s duration. Use existing uploaded inputs rather than submitting the old delayed dialogue. No general video_edit replacement was submitted under a lip-sync claim.

## Photo-reminder question answered
Current scene is S28[2667,2753),111.125–114.708333s, S28-COMPLETE-closed-mouth-nodding-v2.mp4.
Found existing generated listening/nodding source c2c0e8d6-f2bc-4830-a5ca-c54f65f85e33,4s,Kling3.0. Prompt requires closed mouths and no fist bump but does not explicitly redirect gaze to Rexx.
Inspected currentfilm at111.2,111.8,112.4,113,113.6,114.2s. Apu/Homer mostly face one another, not clearly the passenger-side Rexx/camera. No separate completed reminder take with corrected toward-Rexx gaze identified. S29 later listening clips are a different line/shot; do not confuse those with S28.
No S28 generation or picture replacement authorized by the question alone in this continuation.

## Pending
Finish secure Higgsfield authentication and genuine wake lip-sync; review Bart candidate; assemble only accepted replacements via canonical render-cut.mjs. Current fullfilm remains AUDIO-CORRECTIONS-V2. No merge,live promotion,new crowd,or new fullfilm claimed.
