# Who is holding what right now (claim before you edit, release when you stop)

| Agent | Files / area | Since | Note |
|---|---|---|---|
| Claude (MASTER) | tools/build-board.mjs, cut-room/storyboard-v2.html, board data | 2026-09-15 | storyboard v3 (sheets, archives) — shipped; BizBox port on bizbox `feat/lyfe-studio` |
| Codex | cut-room/storyboard.html, cut-room/server.mjs | 2026-09-15 | LYFE STUDIO CUT page; merging with storyboard-v2 |
| Claude (MASTER) | bizbox `src/pages/LyfeStudio.jsx`, `public/media/studio/*`, `/studio` route | 2026-09-15 | BizBox port step 2 DONE: PR namesrexx-design/bizbox#15 + sandbox checkpoint 6aa98847 (owner clicks Publish). Next: media uploads (Core.UploadFile function), agent door, Cut Room inside BizBox. No uncommitted work in `bizbox-lyfe-studio-worktree` |

Astra completed 2026-09-16: standalone automatic scene sync server/client and launcher, documented in STORYBOARD-AUTO-SYNC.md. Claim released; original page, builder, server and generated data remain untouched.

| Claude (MASTER) | port 4321 on the PC | 2026-09-15 | Storyboard auto-sync ACTIVATED: old static server stopped, `serve-storyboard-sync.mjs --root <PC board folder>` running (launch.json `storyboard-sync`); revision 5ff88f88, S08+S09 selected and playing. Root override pushed as b45c160. |

| Claude (MASTER) | V75-CANDIDATE render, deliveries/S21, storyboard S08/S09/S11-13/S15/S20-22 | 2026-09-15 | V75 rendered + on Drive (renderer fix c1676e6). S21 two COMPLETE candidates delivered. S20/S22 need Homer lip-sync spend (owner go pending). Sync server running on 4321. |

| Claude (MASTER) | V75.1 render, deliveries/S09 v2, S21 candidates | 2026-09-15 | V75.1 on Drive (S09 full reply restored). Waiting on owner: S21 pick, S20/S22 lip-sync spend, S24 swap. Codex: point S09 completedDelivery at v2 raw URL. |
