# YouTube adapter: what exists, what Rexx has to do once

Built 2026-09-20 to the brief in bizbox `docs/social/CLOUD-CODE-SOCIAL-SCHEDULER-RUNBOOK.md`. Status: code written, 10 tests pass against a mocked YouTube. **Not yet tried against real YouTube**, because that needs Rexx's Google login.

## What it does
- `youtube.mjs`: validates a queued post, refreshes the OAuth token, opens a resumable upload, sends the file, reads the video back from YouTube, returns a receipt.
- Every upload is **private**. A release time uses YouTube's own `publishAt` (private until that moment). Without a release time only a private draft can be uploaded.
- Refuses unless: the post is `approved` (for anything with a release time), `ai_generated` is set true/false (no default), the asset is inside the media folder, and it hasn't been submitted before.
- A dropped connection mid-upload is `unknown` with the upload session kept, never `failed`, so it is never uploaded twice.
- `youtube-cli.mjs <postId>` is a dry run by default; `--apply` sends, `--private-draft` uploads a private video with no release time. It writes the receipt back to the scheduler post.
- It is **not** wired into the scheduler's minute timer. Nothing uploads unless someone runs the CLI. Wiring it in is a separate decision.

## Rexx's one-time setup (about 10 minutes)
1. Google Cloud console: create a project, enable **YouTube Data API v3**.
2. OAuth consent screen: External, add your Google account as a test user. To avoid the 7-day refresh-token expiry that Testing mode has, set it to In production (you will see an "unverified app" warning for your own account: that is fine).
3. Credentials: create an **OAuth client ID** of type *Web application* with authorised redirect URI `http://127.0.0.1:53682/cb`.
4. On your PC, in PowerShell (the values stay in your shell, never in chat):
   `$env:YT_CLIENT_ID='...'; $env:YT_CLIENT_SECRET='...'; node deploy/scheduler/adapters/youtube-auth.mjs`
   Open the URL it prints, sign in as the channel owner, approve. The refresh token is saved into the server's `.env`.
5. Then a **private draft test** (nobody can see it): `node youtube-cli.mjs <postId> --private-draft --apply` for a post you have marked `draft` with `ai_generated` set.

## Limits (from YouTube, verify current)
- An API project that has not passed YouTube's **API audit** can only create private videos, even with publishAt. Public scheduled release needs the audit.
- Each upload costs about 1,600 quota units of a default 10,000 per day.
- `containsSyntheticMedia` is sent from `ai_generated`, matching the disclosure rule for AI-generated video.
