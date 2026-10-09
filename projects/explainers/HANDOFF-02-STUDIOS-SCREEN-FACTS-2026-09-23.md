# Handoff → LYFE Studios session: Studios explainer, verified screen facts (2026-09-23)

Rexx: "continue in lyfe studios." This note is what the owner's live session had already
verified so the Studios shot sheet (same format as Explainer 01 BizBox) does not re-check it.

## Format Rexx locked for every card
real screen/state · exact action · shot/camera treatment · duration · narration purpose · fallback if the live state is unavailable.
Plus the BizBox directing locks (same file, "Directing locks" section): same desk/camera for S01 and S06; normal user behavior; overlays labeled Visualization; real recordings only; no admin data; 9:16 readable on mobile; deliberate cursor; sound design chain; minimal copy.

## The six approved Studios lines (from the pack, gate-checked)
| Card | VO | On screen |
|---|---|---|
| S01 | Somebody books. Then they don't show. You held that hour. | They don't show |
| S02 | Your own photos go up to your Google Drive. | Your own photos |
| S03 | Agents sort them. Services. Hours. The gaps between clients. | Agents sort the gaps |
| S04 | Your day gets built in. Your lunch stays your lunch. | Your lunch stays |
| S05 | A booking page. Clients verify, prepay, and get reminders. | Verify. Prepay. Reminders. |
| S06 | BizBox Studios. You get paid the morning after each session. | BizBox Studios |
End card on S06: Try it free · biz-box.io/lyfe.

## Real screens that exist today (checked live, logged out, 2026-09-23)
| URL | What is on it (verbatim text) |
|---|---|
| `app.biz-box.io/studio/demo-massage` (also on biz-box.io) | Banner: "Demo page. Made-up artist, example prices. Nothing is saved and no money is taken." · LOS ANGELES AREA · Demo Massage Studio · "Massage by appointment, one client at a time." · Insured · Deposit holds your date · Services: Swedish 60 $95 · Deep tissue 60 $110 · Swedish 90 $135 · HOURS Monday to Friday, 9am-5pm · Book a time form: Your name, Mobile, Email optional, Service, Date, Anything we should know, "This is my first visit", terms line "First-time clients verify their identity once, online." · Footer: "Deposits go to the artist through PayPal. Client verification is an identity match, not a background check." |
| demo fixture `src/content/studios-demo-massage.json` | `lunch_block: "1:00-2:00 pm"`, `buffer_minutes: 15`, `deposit_percent: 0`. The slot grid disables 12:15pm to 1:45pm around the lunch block (verified 2026-09-19). |
| `app.biz-box.io/studio/demo-bridal` | bridal fixture: `deposit_percent: 30`, `ready_buffer_minutes: 30`, bride photo upload live |
| `biz-box.io/studios/start` | "START YOUR INTAKE · First, an account. Then upload everything. · Your intake saves as you go… · Create my account or sign in" (member-only past this point) |
| `biz-box.io/studios` | offer cards: "DO IT YOURSELF · Skill 8/10 · A step-by-step guide · Your page, your services, your prices · Sign up for a free demo" (no prices shown; the DIY/DWY/DFY cards are the 09-16 three-tier layout) |
| Routes (App.jsx) | `/studios`, `/studios/bridal`, `/studios/start`, `/studios/thanks`, `/studios/dashboard` (owner, signed in), `/studio/:slug`, `/studio/:slug/pay/:id` |

## Fallbacks and no-fakes
- Never record a real payment. Stop on the deposit button; `/studio/:slug/pay/:id` is real PayPal.
- `/studios/dashboard` and the assistants/payout section need a signed-in studio owner (PR #27 in bizbox, unmerged, untested by a human). If unavailable, S05 uses the public booking page only.
- Client verification (selfie + ID) has no public demo screen; show it as the terms line + the "This is my first visit" tick, or an abstract labeled Visualization.
- Demo page banner "Made-up artist, example prices" may stay in frame; it is true.

## Prices
Example prices are on the demo page. The VO lines carry no numbers (pack rule). Do not read them aloud.

Files: pack `EXPLAINER-STORYBOARDS-2026-09-22.html`, locked sheet `EXPLAINER-01-BIZBOX-SHOT-SHEET-2026-09-23.html`, both in this folder and in `video-edit-room/projects/explainers/` (branch `agent/claude/explainer-storyboards-20260922`, PR #27).
