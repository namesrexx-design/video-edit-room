# Storyboard automatic scene sync

Use the existing LYFE page on port 4321 with a companion server. No edits to the existing page, generated data, builder, or server are required.

## One-time activation on the PC

1. Bring the merged files into the video-edit-room checkout using the normal agent workflow. Preserve local edits; do not reset the shared checkout.
2. Stop the existing `node server.mjs` process in its terminal with Ctrl+C.
3. Double-click `START-STORYBOARD-SYNC.cmd` from the repository root, or run `node tools/serve-storyboard-sync.mjs` there.
4. Open or refresh `http://127.0.0.1:4321/storyboard.html` once.

Requires Node.js 18+ and GitHub CLI signed in with access to namesrexx-design/bizbox (`gh auth status`). The connector in ChatGPT cannot start a process on the owner's PC. The launcher does not kill processes, pull over edits, install software, or request credentials in chat.

## Automatic behavior

Every 15 seconds, the server reads the merged commit of BizBox's `codex/video-storyboard-reference-hub` branch through the PC's GitHub CLI login. It fetches the source storyboard pinned to that commit only when changed. The page checks every five seconds, refreshes scene metadata, and shows selected COMPLETE clips with their embedded audio. Normal propagation is about 20 seconds plus network time. An active video/audio playback or focused text input defers refresh.

The initial S08 and S09 selections were merged in BizBox PR17. Future changes must be merged to the configured branch. A different branch can be selected with STORYBOARD_SOURCE_BRANCH; this must be the actual production source branch, not assumed main. Default source repository is namesrexx-design/bizbox.

The response view retains local character/set/prop sheets and cut timings. Scene title, line, status, completed selection and fullVideo are refreshed. Finished clips have a dedicated playable section in both storyboard pages. This is automatic **scene selection and metadata** sync, not full character-sheet regeneration, new media generation, or full-film rendering. A selected S08 does not falsely mark it inserted in V74.

Source and generated JSON files on disk are never overwritten. The last good in-memory view survives a network/auth error; the page displays the failure. On server restart while offline, the checked-in local view remains available. No paid services, auto-push, auto-merge, renderer or social publication is invoked. Server binds only to 127.0.0.1.

## Verification

`node --test tools/storyboard-sync.test.mjs` verifies source revision changes, propagation to board responses, offline preservation, no writes to generated data, script injection, video byte ranges, invalid ranges, rejected writes and path confinement. Client syntax check passes. Actual Windows activation, owner GitHub authentication and browser playback require the PC; not claimed verified remotely.
