# Server job 1: promote V6 into the watched preview and prove the watcher

V6 is confirmed for BOTH picture and audio. Audio V2 is superseded.

This package includes the approved 115,727,371-byte master. SHA256:
76135F02600B5770704AA7CCB35A1DFCE22F9A2269E325696539E0FF840C09B5

The GitHub branch is `agent/codex/v6-watched-cut-20260917`. Its actual `projects/garage-dream/cuts/STORYBOARD-FINAL.json` now points at the complete V6 master through folder `team`; the previous watched cut has a named backup. It uses the embedded V6 audio, with linked mute-picture/audio lanes. There are no PRIOR-FULL or missing-WAV dependencies.

## Run on the server host

Extract this package into a new directory on the server, then from that directory:

```bash
python3 tools/run_server.py
```

Defaults are /srv/lyfe/repo, /srv/lyfe/media and /srv/lyfe/editor. The script uses the server's existing GitHub authentication; it never asks for or moves keys. The repaired PR23 studio worker must already be running, as confirmed in the handoff.

The script:
1. Hash-verifies and stages V6 under /srv/lyfe/media/team/garage-dream/FILM/.
2. Hashes the reported old pass-17 previews and reads their actual watched cut from Git.
3. Fetches the new branch, checks its watched cut against this package, and pushes an empty render-request commit only after the media is staged. This handles any earlier failed watcher attempt caused by missing media.
4. Waits for the real deployed watcher. It does not invoke a substitute render command.
5. Verifies the watcher receipt's actual rendered commit (including explicit verified reuse), cut SHA, exact V6 source SHA, 3334-frame duration, output SHA and byte count, and proves the new output differs from the reported old previews.

Return these files from receipts/:
- WATCHER-V6-PROOF.json
- WATCHER-V6-RENDER.receipt.json

If it stops, return WATCHER-REQUEST.json and the reported error. Do not bypass the failed check. A timeout is not approval to render or release social clips.

This job does not merge main, change DNS, post, schedule, or release clips. After the watcher proof returns, Codex will finish the four wide/vertical social exports and their per-file receipts using V6. Caption position stays MarginV 1100; all uncaptioned masters are retained. Scheduler data is already prepared and will be checked against the actual delivered outputs.
