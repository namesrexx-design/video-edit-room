# LinkedIn video adapter

Built 2026-09-20 from LinkedIn's Videos API and Posts API docs (read the same day). 9 tests pass against a mocked LinkedIn. **Not tried against real LinkedIn.** No CLI yet, and not wired into the scheduler timer.

- Flow: initializeUpload -> PUT each byte range (keep ETags) -> finalizeUpload -> poll until AVAILABLE -> POST /rest/posts.
- Publishes PUBLIC at once. LinkedIn accepts only `lifecycleState: PUBLISHED` at creation: no draft, no scheduling. Receipt mode is `worker-timed`. Refuses unless the post is `approved` and `ai_generated` is set.
- MP4, 3 s to 30 min, 75 KB to 500 MB. No public URL needed (bytes are uploaded directly).
- Env (server .env, never chat or git): `LI_ACCESS_TOKEN`, `LI_AUTHOR_URN` (urn:li:person:... or urn:li:organization:...), optional `LI_VERSION` (default 202609, inferred from the docs' version list), `LI_API_BASE`.

## NOT found in the docs read (do not assume)
- Which LinkedIn product/approval gives an app `w_member_social` / `w_organization_social` (Share on LinkedIn vs Community Management API).
- Token lifetime and refresh.
- Any AI-disclosure API field: the disclosure has to be in the caption.
- Whether `Linkedin-Version: 202609` is currently accepted.
