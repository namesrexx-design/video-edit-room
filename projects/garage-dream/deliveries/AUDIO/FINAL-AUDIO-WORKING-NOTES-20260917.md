# Final audio continuation — working checkpoint, 2026-09-17

Owner approved the full Homer-whisper film, then requested pre-sleep Bugatti, Bart exit laughing, wake-up lip-sync review, and final crowd/effects work. Owner clarified that most recordings already exist; reuse them.

## Confirmed sources
- Current base GARAGE-DREAM-HOMER-WHISPER-20260917.mp4: 3070 frames, SHA256 8BCE2D477DDF61A3A59B9E25D2326E2578AEFEC9EBF29070B9D2E3A54F0B2935.
- Existing repo AUDIO/S16-T2.mp3 is HOMER-EARLY-BUGATTI-WHISPER-V55, 1.194 seconds. Use this established whisper, not the new alternative generated before the owner correction.
- Existing AUDIO/AUD014.mp3 is Bart's approved 3-second recording and contains laughter after the complete taunt; laughter around source 2.08–2.56 s. Retain current AUD016-derived taunt and restore this original laugh tail.
- Snore, mosquito, horn and dream soundtrack already exist in the accepted film. First snore remains exactly 64 s. Greeting crowd was removed by owner: do not restore it.

## Wake repair status
- Dedicated sync_so cannot pass connector validation: canonical video/audio roles rejected by model, model-native input_video/input_audio rejected by tool schema. No sync_so job submitted/charged.
- Browser fallback found Higgsfield logged out; no credential request or sign-in attempted.
- One supported Seedance 2.5 video_edit take submitted: aff2103c-06a5-4a2a-9b57-fb1a97cf870c. Estimated 45.37 credits, 1080p, generate_audio=false. Input is the existing 121-frame wake shot and its original audio, full frame. No replacement voice is being generated. Pending result inspection; do not claim repaired yet or submit another take blindly.
- Input video media 05c433d0-eeef-46ee-8338-0ff9db3556ce; original audio media 89bfe555-3998-41e8-bf05-693cc55559a0. Original range [1840,1961) / 76.666667–81.708333 s.

## Measured / provisional mix decisions
- Current whole film: -18.08 LUFS, -2.11 dBTP, LRA7.70; no clipping detected. Technical meter and sampled frame review are not a continuous human listening sign-off.
- Restore S16-T2 at frame1490 (62.083333s), full28frames, +5dB as a soft aside; finishes before64s.
- Restore AUD014 source[48,72) at frame2004 (83.5s), +7dB; follows complete Bart line and ends before existing horn. Consider +2dB only on current Bart phrase.
- Keep no constant crowd. Existing supplied crowd files were not identified in repo/Drive searches; prepare short event-based cues after garage reveal, Bugatti misunderstanding, and final Blood/upward-look payoff. Do not cover lines or add greeting audience.

This checkpoint records work in progress, not final approval, deployment or a merge. Existing live cut unchanged.
