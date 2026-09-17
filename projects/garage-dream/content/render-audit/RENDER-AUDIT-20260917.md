# Render audit and delivery hold

## Confirmed cause

The three referenced commits (751bbc7, 4346aac, a8a550e) all contain the same watched cut, projects/garage-dream/cuts/STORYBOARD-FINAL.json:

- Git blob: 0c08da309ae2af0a1cab235a56cbdfa4f01b214a
- Name: STORYBOARD-FINAL pass 17 — corrected scene assembly candidate
- Frames: 3072
- Owner reports all three previews are 73,826,175 bytes with identical MD5. Those server bytes were not independently retrieved in this audit because server access is unavailable.

The server correctly reads that fixed pathname. The corrected cuts and final media were saved separately and never promoted into the watched cut. The watcher adds another bug: it compares the entire branch against main, then queues a preview for every new branch SHA. Once the branch differs at the watched pathname, even a documentation or voice receipt commit rerenders the same film.

The separate V6 cut also points at FILM/PRIOR-FULL.mp4 and AUDIO/GARAGE-DREAM-FULL-AUDIO-V6.wav under repo-deliveries. These are not present in that branch's delivery tree. Merely changing the watched cut to V6 would therefore fail with missing media.

## Prepared fix

- Preview identity uses the effective rendering fields, renderer code and source versions, instead of commit SHA alone.
- Unchanged inputs reuse the previous verified file and hash.
- Each new preview verifies the requested cut hash against the renderer receipt and the copied film against its output hash.
- If rendering inputs change but the output hash stays identical, preview readiness fails closed.
- Receipts beside previews record sourceTimeline, commit, cutSha256, source versions, rendererSha256, outputSha256, MD5, frames and bytes.
- The fix is on fix/render-provenance-social-delivery-20260917. This non-agent branch is deliberately outside the faulty agent-preview watcher. No main merge or deployment was performed.

## Verification completed

Six Node tests pass. The actual native renderer was also run on isolated synthetic footage: changing the cut from 24 to 23 frames changed output SHA256 from 0FCFA129135085F19A16A305D49B3E5847C11A529DA9F4FBB266625232DFBCB2 to 45C6ACEF6B90A38BEA6C4AD1E43FD250BB2BB60E3BEAC552162DC67F7BEFA601. See LOCAL-TIMELINE-PROOF.json. This proves the local renderer responds to edits; it does not certify the deployed server watcher.

## Still blocked: server gate and delivery

studio.biz-box.io was unreachable from this workspace (502) and unresolved from the remote media runtime. mcp.biz-box.io responds 401. BIZBOX_TEAM_KEY and the documented SSH key are absent in this session. No credentials were guessed, no authentication bypassed and no keys committed.

Required continuation:
1. Restore authenticated server/connector access. Deploy/restart the repaired worker through the normal authorized server process.
2. Run node tools/verify-preview-timeline-change.mjs on that server, then exercise the actual preview watcher with two diagnostic timeline revisions. Keep their preview receipts and confirm changed cut/fingerprint AND changed output hash.
3. Upload the exact approved V6 master (SHA256 76135F02600B5770704AA7CCB35A1DFCE22F9A2269E325696539E0FF840C09B5) to the team media path. Preserve current watched cut as a numbered backup. Only then promote the verified media-backed V6 cut, render its full server preview, and verify receipt and downloaded bytes.
4. Resolve source wording: V6 and Audio V2 are separate full-film revisions in the repository. V6 includes later approved changes. Do not silently replace its soundtrack with the earlier Audio V2 mix. The prepared clip manifest uses the approved V6 windows and holds an older-audio override for clarification.
5. Render the four clips into deliveries/CLIPS-SOCIAL. Keep wide and vertical masters plus separate captioned derivatives (16 files total). Vertical: 1080x1920, ASS MarginV 1100 exactly. Use final-audio Whisper timing, verify words and burn visibility, keep source intact. Each actual output gets source timeline, duration and actual hash in its own receipt.
6. Validate post-plan.json with --require-assets before scheduler consumption. The nine records pass schema/caption checks now; asset readiness intentionally fails until delivery.

No new film cut or clip was shipped after the owner's hold. No social posting or scheduling was performed.
