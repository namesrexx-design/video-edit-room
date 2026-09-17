# Audio corrections V2 — delivered 2026-09-17

## Owner direction overrides earlier review speculation
Rexx said the film looks/sounds much better. He clarified that Homer should whisper Bugatti three or more times while drifting off from58s; first wake line begins1:17; beach sentence is already in sync; Bart should laugh again as he leaves with his mouth open.
Do not shift the beach sentence based on the previous agent's speculative concern. Owner confirmed it.

## Current output
GARAGE-DREAM-AUDIO-CORRECTIONS-V2-20260917.mp4, saved in Drive EDIT_ROOM and delivered in chat.
3070frames,24fps,1920x1080,127.916667s;70,820,597bytes.
SHA256 BF931CE756E1DE0D0617FABBA864758EFC2339BBCDF707DC85F358D83D1A483D.
Previous AUDIO-FINAL-REVIEW output retained. No live promotion or merge.

## Exact edits
- Inspected frame sequences around58–64s,76.8–79.4s,and82.7–84.6s. Picture content, framing and durations unchanged.
- Rebuilt pre-sleep audio [1391,1536) with clean existing S10-T2 source[281,421) at1391,gain2dB; removed previous single-whisper layer by replacing this mixed interval.
- Used three DISTINCT existing AUD018 whispers: source[1,22)at1406(58.583333s);[24,42)at1458(60.75s);[45,64)at1500(62.5s),gain4dB. Actual voiced onsets follow their short source lead-ins. All finish before the original64s snore.
- Shifted first wake sentence source[1875,1903) to1848=77s,1.125seconds earlier. Removed old occurrence. First phonetic onset is approximately77.04s. Kept leading D'oh.
- Original sound resumes at1903(79.291667s), including the unchanged beach sentence. No second-sentence shift.
- Preserved first Bart laugh and added another original AUD014 excerpt[49,63)at2018=84.083333s,gain7dB. Ends84.666667s,before horn at84.708333.
- Prior S29 'Did I convert to Hindu?' whisper retained. Crowd not changed. No generation or new voice spending.

## Proof
Canonical tools/render-cut.mjs with cuts/GARAGE-DREAM-AUDIO-CORRECTIONS-V2-20260917.json.
Full decode passes,3070frames,0black intervals,SHA matches renderer receipt.
-18.48LUFS,-2.11dBTP,LRA6.2,no clipping.
Waveform comparisons after AAC re-encoding allow at most1ms for renderer millisecond rounding:
first shifted sentence correlation0.999991;beach unchanged0.999992;snore/dream unchanged0.999955;closing whisper unchanged0.999974.
These verify edit positions and preservation; they are not a claim of calibrated listening or every phoneme matching.

## Recovery and next
The cut references the previous approved AUDIO-FINAL-REVIEW MP4 under repo-deliveries/FILM; recover that MP4 from EDIT_ROOM into the exact filename. Existing S10-T2,AUD018,AUD014 remain in repository deliveries/AUDIO. Private media access links are deliberately excluded from this public repository.
Full verification and renderer receipt are in AUDIO-CORRECTIONS-V2-20260917-verification.json.
Owner playback of this V2 is next. Crowd/effects cue plan remains FINAL-AUDIO-CUE-PLAN-20260917.json; no audience added in this correction. Preserve no greeting crowd and first snore64s.
