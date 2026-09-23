# Who is holding what right now (claim before you edit, release when you stop)

| Agent | Files / area | Since | Note |
|---|---|---|---|
| Claude Sonnet 5 | `projects/aries/`, branch `agent/claude/aries-storyboard-20260923` | 2026-09-23 | New recurring-character storyboard structure (source/episodes/deliveries), applied for the first time. E01-flood-eviction mid-audit: A02 v2 and A04 unverified by Rexx, A03 needs redo chained from A02, A05 not yet generated. Bestia and Sugarfish get the same structure next, from existing approved assets only. |
| Claude (MASTER) | tools/build-board.mjs, cut-room/storyboard-v2.html, board data | 2026-09-15 | storyboard v3 (sheets, archives) — shipped; BizBox port on bizbox `feat/lyfe-studio` |
| Codex | cut-room/storyboard.html, cut-room/server.mjs | 2026-09-15 | LYFE STUDIO CUT page; merging with storyboard-v2 |
| Claude (MASTER) | bizbox `src/pages/LyfeStudio.jsx`, `public/media/studio/*`, `/studio` route | 2026-09-15 | BizBox port step 2 DONE: PR namesrexx-design/bizbox#15 + sandbox checkpoint 6aa98847 (owner clicks Publish). Next: media uploads (Core.UploadFile function), agent door, Cut Room inside BizBox. No uncommitted work in `bizbox-lyfe-studio-worktree` |

Astra completed 2026-09-16: standalone automatic scene sync server/client and launcher, documented in STORYBOARD-AUTO-SYNC.md. Claim released; original page, builder, server and generated data remain untouched.

| Claude (MASTER) | port 4321 on the PC | 2026-09-15 | Storyboard auto-sync ACTIVATED: old static server stopped, `serve-storyboard-sync.mjs --root <PC board folder>` running (launch.json `storyboard-sync`); revision 5ff88f88, S08+S09 selected and playing. Root override pushed as b45c160. |

| Claude (MASTER) | V75-CANDIDATE render, deliveries/S21, storyboard S08/S09/S11-13/S15/S20-22 | 2026-09-15 | V75 rendered + on Drive (renderer fix c1676e6). S21 two COMPLETE candidates delivered. S20/S22 need Homer lip-sync spend (owner go pending). Sync server running on 4321. |

| Claude (MASTER) | V75.1 render, deliveries/S09 v2, S21 candidates | 2026-09-15 | V75.1 on Drive (S09 full reply restored). Waiting on owner: S21 pick, S20/S22 lip-sync spend, S24 swap. Codex: point S09 completedDelivery at v2 raw URL. |

| Claude (MASTER) | storyboard S20–S22 | 2026-09-15 | REMOVED from the film by the owner (Bart → horn). V75.1 already has that order. No lip-sync spend. |

| Claude (MASTER) | GitHub Pages | 2026-09-15 | Storyboard + film published no-login at https://namesrexx-design.github.io/video-edit-room/cut-room/storyboard-v2.html ; sync server retired on the PC (owner). |

| Claude (MASTER) | V76 render | 2026-09-15 | V76 on Drive + Pages storyboard: S09 reply once, no hold, horn up. Lip-sync presence in the V74 body measured (S27 L1, S14, S18 are IN). Awaiting owner playback. |

| Claude (MASTER) | STORYBOARD FINAL film | 2026-09-15 | GARAGE-DREAM-STORYBOARD-FINAL-2026-09-15.mp4 delivered (Drive root + EDIT_ROOM, deliveries/FILM, Pages storyboard player, chat). 2807 f. S25/S26 not on the board and no uploads found; add when Rexx uploads. |

| Claude (MASTER) | STORYBOARD FINAL pass 7 | 2026-09-15 | new S24 in; delivered. S25/S26 not found anywhere. |
