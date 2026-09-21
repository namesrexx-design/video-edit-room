# Instagram Reels adapter: what exists, what Rexx has to do once

Built 2026-09-20 to the brief in bizbox `docs/social/CLOUD-CODE-SOCIAL-SCHEDULER-RUNBOOK.md`, using **Instagram API with Instagram Login** (host `graph.instagram.com`, Graph v25.0 as shown in Meta's docs that day). Status: code written, 9 tests pass against a mocked Instagram. **Not tried against real Instagram** (needs Rexx's Meta app and token). The temporary public-link step (`r2-link.mjs`) is also **untested**: rclone is on the server and `R2_BUCKET` is set, but no upload was made.

## What it does
- `instagram.mjs`: validates a post, makes a Reels container (`media_type=REELS`, `video_url`, `caption`, `is_ai_generated`), waits for `status_code=FINISHED`, publishes with `media_publish`, reads the permalink back, returns a receipt.
- **Instagram has no private draft.** A successful publish is public at once. So it refuses unless the post is `approved`, and unless `ai_generated` is set true/false (no default).
- No future-scheduling field was found in Meta's docs, so it publishes NOW. The scheduler must call it at the due time and the receipt says `worker-timed`, never `native-scheduled`.
- A timeout on the publish call or a failed confirmation read is `unknown` (container/media id kept), never `failed`: reconcile, never retry blindly. Meta rejecting the video (`ERROR`/`EXPIRED`) is `failed` and safe to retry because nothing was published.
- `r2-link.mjs`: our media is behind a password and Meta downloads the video itself, so it copies the file to a temp prefix in the R2 bucket and makes a short-lived public link with `rclone link --expire 3h`. The temp object is left in place (never delete); only the link expires.
- `instagram-cli.mjs --whoami` is read-only (which account is the token for). `<postId>` is a dry run by default; `--apply` publishes publicly.
- Not wired into the scheduler's timer. Nothing publishes unless someone runs the CLI.

## Rexx's one-time setup
1. The Instagram account must be **Business** or **Creator** (Meta docs: Business / Media_Creator). Switch it in Instagram settings if it is personal.
2. developers.facebook.com: create an app of type **Business** (Meta's docs say other types will not work).
3. In the app dashboard: **Instagram > API setup with Instagram business login**, click **Generate token** next to the account, log in to Instagram, copy the token. Meta says dashboard tokens are **long-lived, valid 60 days**.
4. Save `IG_ACCESS_TOKEN` and `IG_USER_ID` into `/srv/lyfe/repo/deploy/.env` on the server without pasting them into chat or git (a helper like `youtube-auth.mjs` can be written for this).
5. Read-only check: `node instagram-cli.mjs --whoami`.
6. A real publish needs an approved post and is public. Use a throwaway test post on the account you are happy to have live, then delete it in the Instagram app.

## Limits and unknowns (from Meta's docs; verify current)
- 100 API-published posts per 24 hours.
- Meta cURLs the media: it must be on a publicly accessible server. Range/Content-Length/timeout requirements were **not** in the pages read.
- Whether Advanced Access / App Review is needed for an app in development mode used on your own account was **not stated** in the pages read. Expect to try it and see.
- Token refresh: 60-day tokens must be refreshed before they expire. The refresh call was **not** verified against the docs and is not implemented.
- Facebook Page video is a separate adapter: Meta's Page video docs read that day did not list scheduling parameters, so nothing about Facebook scheduling is assumed.
