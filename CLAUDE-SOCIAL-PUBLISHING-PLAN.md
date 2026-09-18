# Bizbox social publishing — Claude implementation handoff

Prepared for Rexx • 18 September 2026

**Correction and release gates (18 September):** The existing site destination is `https://biz-box.io/links`, as documented in the Bizbox repo and guides. Remove the unverified domain inferred from the earlier dictated message from all proposed destinations. No domain migration, canonical-link replacement, or social-bio change is authorized by this plan. The scheduler's missing-key fail-open behavior must be fixed and verified before enabling agent access. Posting volume remains unresolved: do not assume total versus per-platform volume or commit to a paid plan.

Goal: connect Rexx's social accounts to a shared publishing system that Claude and Codex can operate. Cover the accounts named in issue #25: TikTok, Instagram, YouTube, X, Facebook, LinkedIn, and Snapchat. Inventory Threads, Pinterest, and Kick before enabling them merely because their names exist in the scheduler. Keep the working manual file-and-caption handoff available throughout.

Recommendation: finish the existing scheduler and connector on the paid-for Hetzner server. Keep GitHub as the shared source, R2/server media as the canonical assets, and the server scheduler as the only queue. Preserve the existing Higgsfield TikTok path; add direct API adapters for the remaining eligible accounts. Evaluate Buffer only as a transport adapter if it removes an actual review or implementation blocker at an approved cost. Do not migrate the calendar or content ownership to Buffer. This is a plan, not an implementation or live-server verification.

1. **Inventory access and existing work before building**

Inspect `namesrexx-design/video-edit-room` issue #25 and `namesrexx-design/bizbox` issue #23, including their latest comments, from the authenticated development environment. Reuse existing integrations and the canonical content package. All four issues (#25 in video-edit-room; #21, #22, and #23 in bizbox) and the latest comments on #25/#23 were read through authenticated GitHub access. Current main-branch AGENTS.md, ONE-COPY.md, docs/SERVER-FIRST.md, deploy/scheduler/store.mjs, deploy/scheduler/server.mjs, and deploy/Caddyfile were also read. The named video-production/SKILL.md was not found at the tested repo paths; Claude must resolve it in the existing build workspace. The hook rule is also recorded in bizbox#23.

Create an account register with platform, exact handle/channel ID, brand, owner, account type, existing provider/app, connected state, automatic video support, and next action. Record IDs returned by authenticated APIs, not guessed IDs. Distinguish LYFE, Bizbox, and other brands. Identify the scheduler's existing backend, hosting, data store, authentication, and deployment process.

Preserve these reported findings: manual uploads work; ONE COPY matched across two branches; the scheduler has a native Basic Auth prompt; 22 Claude processes consumed 5.86 GB. Emulator or RAM expansion is not a dependency of this API implementation.

2. **Keep the server architecture; evaluate a provider only for gaps**

First inspect existing server credentials and app registrations without displaying secret values. For a provider fallback, use an existing Buffer account if available; otherwise prepare setup and show the exact plan cost before any purchase. Rexx completes social sign-in, MFA, and consent using the official account-connection flow. Retrieve the resulting channel IDs and verify each against the intended handle.

Buffer's API uses an account API key and supports channel lookup and post creation. Its assistant-specific guides describe OAuth connections for Claude and ChatGPT/Codex. Follow the guide appropriate to the actual client; verify that the current ChatGPT Work environment permits installing the connection. Configuring Claude does not connect this conversation automatically. [Buffer quick start](https://developers.buffer.com/guides/getting-started.html), [Claude connection](https://developers.buffer.com/guides/integrations/claude.html), [ChatGPT/Codex connection](https://developers.buffer.com/guides/integrations/chatgpt.html).

The documented MCP endpoint is `https://mcp.buffer.com/mcp`. Its publishing tool lists TikTok, Instagram, YouTube, and X, and distinguishes automatic publishing from notification reminders. API keys have account-wide reach; use a backend secret store and never put keys in issues, prompts, source control, or the public site. [Buffer MCP documentation](https://developers.buffer.com/guides/integrations/mcp.html).

Acceptance check: confirm automatic video publishing for each connected account and intended format, including YouTube Shorts versus longer uploads. Buffer's general scheduling page omits TikTok from its platform list while its MCP documentation includes it. Resolve that documentation mismatch through an authenticated capability test; do not promise TikTok automation from a marketing statement alone. [Scheduling guide](https://developers.buffer.com/guides/posts-and-scheduling.html).

Video assets use a source URL; YouTube metadata includes title and category. Serve the approved media through a provider-accessible HTTPS URL with a lifetime sufficient for ingestion and retries. Check actual file type, size, duration, aspect ratio, captions, and disclosure fields against the connected account's limits. [API schema](https://developers.buffer.com/reference.html).

Budget: the published free plan has three channels, so four social accounts exceed it. Pricing scales by connected channel; multiple brand accounts increase the count. Quote the chosen plan, API allowance, and billing period after the inventory. Do not assume a single social platform equals a single channel. [Buffer pricing](https://buffer.com/pricing).

3. **Platform access worklist for Claude**

| Platform | What Claude prepares | What Rexx completes | Release requirement |
| --- | --- | --- | --- |
| TikTok | Reuse and verify the existing Higgsfield integration reported working on @namesrexx; establish whether the server can invoke it or whether it is agent-session-only. Only if replacement is necessary: a direct app needs developer registration, Content Posting API configuration, `video.publish` permission, OAuth, required preview/settings/consent UI, and status handling. | Account consent and any legitimate developer application steps. | A private tool solely for accounts Rexx or the team manages is explicitly outside Direct Post's accepted use. Do not misrepresent its purpose in an audit. |
| Instagram | Register a Meta app; prefer Instagram Login for the professional account flow. Start with `instagram_business_basic` and `instagram_business_content_publish`; inspect app-role access, review requirements, and token lifecycle in the current dashboard. | OAuth consent for the existing professional Instagram account; verification documents only if the dashboard requires them. | Verify permissions for the actual account and app mode. Do not mix Instagram Login credentials/scopes with the separate Facebook Login route. |
| YouTube | Enable YouTube Data API v3 in a Google Cloud project, configure OAuth and callback URL, obtain `youtube.upload` access with refresh handling, and implement resumable upload. | Google/YouTube sign-in, correct channel selection, and owner-side verification. | Check OAuth production/verification status separately from the YouTube API compliance audit that lifts private-only uploads. |
| X | Create developer app, configure user-context OAuth and current write/media scopes, implement media upload/processing then post creation, and enable usage accounting. | Developer ownership, billing where required, and account consent. | Confirm current endpoint entitlement, credits, media limits, and returned post ID. An app-only bearer token is not a substitute for user posting authorization. |

TikTok unaudited clients are restricted to private viewing. Its separate Upload API hands content to the user to finish in TikTok; that is a useful assisted route, not fully automatic publication. Preserve required user control and commercial-content settings. [TikTok Direct Post guidelines](https://developers.tiktok.com/doc/content-sharing-guidelines), [Direct Post setup](https://developers.tiktok.com/doc/content-posting-api-get-started), [Upload flow](https://developers.tiktok.com/doc/content-posting-api-get-started-upload-content).

Meta's official collection documents professional accounts and Instagram Login scopes. Claude must verify production review requirements in the app dashboard because Meta's main documentation was rate-limited during research. [Meta's Instagram API collection](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api).

YouTube documents private-only uploads from unverified projects created after 28 July 2020. Google also documents seven-day refresh-token expiry for external OAuth apps in Testing, with limited basic-profile exceptions. Test renewal and reconnection explicitly. [YouTube upload reference](https://developers.google.com/youtube/v3/docs/videos/insert), [Google OAuth lifecycle](https://developers.google.com/identity/protocols/oauth2).

X uses pay-per-use pricing; confirm the live rate card and cap spending. OAuth `offline.access` enables refresh tokens. [X pricing](https://docs.x.com/x-api/getting-started/pricing), [OAuth](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code), [Post creation](https://docs.x.com/x-api/posts/create-post).

Additional destinations:

| Platform | Implementation and owner steps | Blocker / fallback |
| --- | --- | --- |
| Facebook | The repo reports only a personal profile with Instagram cross-posting, no Page/Business Portfolio. Verify that state, then have Rexx create/select the intended Page and grant access. Configure the Meta app and Page publishing permissions for the selected video/Reels endpoint; verify any business verification and app-review requirements in the dashboard. | Personal-profile publishing is not the Page API route. Preserve existing cross-posting and prevent duplicate Facebook delivery. Main Meta docs could not be fetched, so exact permission names remain a setup-time verification item. |
| LinkedIn | Register/select app, add the relevant product, get member OAuth with `w_member_social`; for company posting use the organization permission and authorized Page role. Upload video, wait for processing, and create the post using the supported API version. | Confirm product access for video; existing text scheduling is not proof of video access. [Member sharing](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin), [Videos API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/videos-api?view=li-lms-2026-08). |
| Snapchat | Verify a Public Profile, create/select Snap business organization and OAuth app, request Public Profile API allowlisting through Snap, and obtain owner authorization. | The API exists, including Spotlight publishing. Access is allowlist-only, not guaranteed. Keep a clearly marked manual route while pending; Buffer coverage does not establish Snapchat support. [Access requirements](https://developers.snap.com/marketing-api/Public-Profile-API/GetStarted), [Publishing endpoints](https://developers.snap.com/marketing-api/Public-Profile-API/ProfileAssetManagement). |

Corrections to old issue assumptions: YouTube subscriber count does not waive the upload-project audit. X Premium analytics access does not establish API pricing or write entitlement. Snapchat has an access-restricted publishing API. Meta reviews app permissions; creating a Facebook Page alone does not approve an application.

Budget sizing for #25: first resolve whether “10 posts/day” means 300 destination deliveries/month total or 300 content items multiplied across accounts. At seven destinations the latter is about 2,100 deliveries/month. Model uploads, reads, polling, and retries separately. Native API quotas/reviews are not broker subscription fees. Claude must produce current quotes for the actual volume and connected accounts before recommending a purchase; no guaranteed review timeline is assumed.

4. **Give both assistants one publishing system**

Use the existing connector at `https://mcp.biz-box.io/mcp` and queue at `https://mcp.biz-box.io/scheduler`. Follow the server-first skill and ONE-COPY.md. No new Base44 features, separate queues, or large media committed to GitHub.

Verified from current source (deployment state still needs checking):

- `store.mjs` stores the queue in `/data/scheduler/posts.json` by default, with `draft`, `approved`, `ready`, `posted`, `skipped`, and `failed` states. Extend this store without silently replacing the workflow.
- `server.mjs` already supports posts, due, import, and tick endpoints plus `x-scheduler-key`. Both tick branches currently produce `ready`; even setting `SCHEDULER_API_PLATFORMS` does not implement publication.
- The existing key check allows writes when the configured key is empty. Make required authentication fail closed before exposing an agent route. This is a prerequisite, not a post-launch task. Verify missing server key, absent client key, incorrect key, and valid key cases; unauthorized requests must neither mutate the queue nor trigger publication. Check both the externally routed endpoint and backend exposure after deployment. Protect queue reads and media appropriately too.
- Current Caddy source puts `/scheduler`, `/state`, and `/upload` behind Basic Auth. The claim in an earlier comment that `/state` and `/upload` already have a separate token door is not established by this Caddyfile. Inspect deployment before changing routing.
- Add authenticated scheduler operations to the existing connector or a deliberately routed service endpoint. Keep the dashboard protection. Configure header-based service authentication; a browser popup limitation is not a general inability to authenticate HTTP requests.
- Root AGENTS.md says agents must not hand-edit `deploy/` and merges belong to Rexx, while issue #25 requests scheduler work there. Claude should use the established server-maintenance workflow and resolve this repository instruction boundary before changing deployment files. This plan changes no runtime files.
- Apply service rebuild/restart and Caddy reload when needed; a GitHub commit alone does not prove the running process changed. Verify externally afterward.

Suggested operations: list connected accounts; inspect capabilities; prepare a content package; create drafts; schedule or publish an authorized package; read delivery status; cancel pending work. Keep provider credentials on the server. Give Claude and Codex distinguishable client identities, account allowlists, and attributable logs. Connect both to the same job database.

Use a single publication writer. Assistants can prepare and inspect, but release requests must go through the shared ledger so separate conversations or branches cannot publish duplicates. If direct Buffer MCP is used for the initial trial, limit it to inspection/drafts until the publishing ownership and ledger are wired; do not leave two independent release paths.

ONE COPY contract: use the server master and platform captions from `projects/garage-dream/content/post-plan.json`, snapshot their approved revision and SHA-256 hashes, content revision, brand, destination IDs, and user authorization. Store required platform titles, visibility, audience, disclosures, and schedule as explicit metadata. A required alternate caption or export becomes a named revision for approval; never silently truncate, rewrite, or regenerate the approved content. Compare hashes before sending. Platform transcoding means the public playback file need not retain the source file's hash.

Record a unique delivery key per content revision and destination, the provider job ID, platform post ID, URL, attempts, and state. Preserve existing statuses; add delivery-phase metadata for uploading, processing, reconnection, and manual-required states. Set `posted` only after verified delivery. Persist remote IDs immediately. After a timeout, reconcile status before retrying; an ambiguous response must not trigger a duplicate upload. A queued response is not proof of publication.

Use the account's configured timezone for human scheduling and store an unambiguous timestamp. Respect rate limits and token renewal. Verify media access without relying on a browser cookie. Show partial success by platform and retain working manual exports for failures.

5. **Verification and deliverables**

First inspect whether Dream Garage is already posted on each destination. Do not repost it as a connectivity test. Start with drafts or private tests where supported; a public test needs an explicitly authorized asset and destination.

Done means: all intended account IDs verified; automatic versus manual capability shown honestly; an authorized end-to-end publication produces a playable post and URL per supported destination; restart/timeout reconciliation prevents duplicates; expired access produces a clear reconnect action; both assistants see the same content revision and delivery state.

Keep the original soundtrack, AI-generated labeling where offered, and the approved closing CTA. New copy follows the specific-moment hook rule in bizbox#23; do not silently rewrite existing approved captions.

Claude returns the account register, setup links and remaining owner actions, selected provider and cost, working integration and deployment notes, redacted test results, publication receipts, and any platform-specific blockers. Keep app-review estimates separate from engineering estimates. This handoff authorizes planning; obtain Rexx's implementation direction before creating paid services or publishing test content.

6. **Next: the complete Bizbox customer journey**

Use [biz-box.io/links](https://biz-box.io/links) as the existing hub. The earlier domain designation was an unverified interpretation of a dictated message and is withdrawn. Do not change domains, social bios, redirects, payment destinations, or canonical URLs on that basis. Verify the actual deployed route before any release. The user's requested brand direction remains: a more sophisticated hub with LYFE and merch prominent, followed by the rest of Bizbox.

This phase now covers the complete path from a social post through landing-page understanding, signup, delivery, booking, checkout, and agreement signing. Complete and verify those journeys before scaling content. Social API setup and page preparation can proceed without waiting for every platform's app review; keep manual publishing available. Signs-and-numbers content follows the working customer journey.

**First-pass findings — source review, not a live-site certification**

Reviewed Bizbox source at `feat/lyfe-studio`, including its handoff and agreement-review documents, page components, offer data, guide sources, and extracted text from the four current guide PDFs. Reconcile these findings with main and the deployed server before editing; changes on this branch may not be live.

| Finding | Evidence in namesrexx-design/bizbox at feat/lyfe-studio | Required follow-through |
| --- | --- | --- |
| Pending offers can still present hosted purchase links. | `src/components/storefront/OfferTiers.jsx` checks the tier hold list before showing a PayPal link, but does not gate that link on offer readiness or guide availability. Its status notice can say “Opening soon” while the link remains active. | Enforce readiness consistently across hosted links, wallet checkout, and the server. Unready offers collect interest without taking payment. Verify the deployed behavior. |
| Product identity must survive every checkout path. | Hosted links come from shared tier data; `base44/functions/createOfferCheckout/entry.ts` has offer/tier identity and readiness checks, but hosted links bypass that function. | Inspect the actual hosted-link metadata and webhook mapping. Never infer the purchased product from price alone; resolve the guide-versus-subscription price collision in issue #22. |
| Agreement drafts exist but this offer component does not present or record acceptance. | `src/content/offer-agreements.js` defines draft terms and signed tiers; `OfferTiers.jsx` does not import or connect them. | Trace other possible entry points, then wire the approved text and appropriate signing flow into every eligible path. A draft file alone does not establish an agreement with a buyer. |
| Preview loops are not standalone explainers. | `src/pages/LinksWorld.jsx` uses muted looping tile videos. `src/components/storefront/LandingTemplate.jsx` has no dedicated explainer player. | Keep effective previews, but provide explainers that show the actual offer, workflow, output, and next step. |
| Merch copy needs reconciliation. | `src/content/links-world.json` still says hats and mugs, with T-shirts next. | Match the actual approved, purchasable catalog. A preview or interest form is not proof that the merch store is finished. |
| Guide completeness is not established. | `guides/autopilot.md`, `bizbox.md`, `binder.md`, and `credit.md` are procedural guides; all four PDF text extractions were available. No complete skill appendix was identified in the reviewed sources. | Compare every promised skill against its canonical source and delivered PDF. Do not equate finding four PDFs with verifying full skill coverage. |

Source entry points: [implementation handoff](https://github.com/namesrexx-design/bizbox/blob/feat/lyfe-studio/docs/CODEX-HANDOFF-2026-09-17.md), [agreement review](https://github.com/namesrexx-design/bizbox/blob/feat/lyfe-studio/docs/AGREEMENTS-REVIEW-FOR-CODEX.md), [offer checkout UI](https://github.com/namesrexx-design/bizbox/blob/feat/lyfe-studio/src/components/storefront/OfferTiers.jsx), [guide sources](https://github.com/namesrexx-design/bizbox/tree/feat/lyfe-studio/guides).

**Presentation, copy, and explainers**

- Inventory every tile and landing page: audience, concrete outcome, included deliverables, current readiness, price, primary CTA, explainer asset, and destination. Remove contradictions between the tile, page, checkout, guide, and agreement.
- Extract the existing approved colors, typography, and artwork from the actual site. Improve spacing, hierarchy, tile consistency, contrast, mobile readability, and image crops. Keep the detailed embroidery and resolve tote-versus-duffle sizing against the approved product.
- Each explainer must make sense by itself: recognizable problem, actual workflow, visible output, who the offer is for, what is included, and one clear next action. Use real product footage where available. Include captions, readable text, a useful poster frame, accessible playback controls, and a sound-off review. Do not turn a decorative loop into an unsupported promise.
- Review every button, footer, social link, policy link, video, form, download, and redirect on mobile and desktop. Test logged-out and ordinary-member access as well as owner access; `OwnerAccessBoundary.jsx` can hide otherwise valid routes. Honor reduced motion and keyboard navigation.

**Fulfillment and booking**

| Journey | Completion evidence |
| --- | --- |
| Free signup / free resource | Correct source and consent recorded; successful signup; correct resource delivered; confirmation and failure states truthful; duplicate submission handled. |
| Paid DIY guide | Stable product/tier identity; verified payment; correct entitlement and PDF; working receipt/download email; delivery retry and resend; cancellation and failed payment do not unlock paid access. |
| Pitch-deck call | Clear purpose and preparation requirements; correct calendar/event type, timezone, availability, confirmation, and reschedule/cancel path; lead and booking linked. |
| Sales call | Separate, correctly described event where appropriate; correct routing and follow-up; no claim of a confirmed booking before provider confirmation. |
| DWY / DFY engagement | Agreed scope, appropriate signed agreement, payment state, client copy, and onboarding handoff linked to the same customer/order. Work begins only after the required steps. |
| Merch | Approved real products and variants, accurate imagery and price, shipping/tax behavior, checkout, order confirmation, and fulfillment routing verified. |

Use the existing server and integrations; inspect legacy Base44 code for intended behavior without creating new Base44 features. Payment fulfillment must use authenticated provider confirmation and idempotent processing, not merely a success-page visit. Repeated webhook events or refreshes must not duplicate orders, emails, or entitlements. Failed saves must not display successful recording or delivery. Test sandbox payments and controlled test bookings; do not charge a live card, invite real customers, or send external test messages without authorization.

**Agreements and policies**

Create an offer-by-offer comparison of page promises, price, deliverables, revisions, schedule, refunds/cancellation, ownership/license, support, recurring charges if applicable, and signing requirements. Correct factual and copy inconsistencies in reviewable drafts. Preserve the existing attorney-review status of `1.0-draft`; do not label these legally approved.

The repo already flags Automation King LLC as the contracting entity and Wel Kom LLC as the current payment recipient. Preserve the owner's entity wording and resolve the intended arrangement through the existing review process; do not silently substitute names. Check the requested affiliate-assignment provision across all contracts: it appears in the processing draft but not the reviewed DIY/DWY/DFY drafts. Reconcile the guide's “no cut of sales” language with any applicable processing fee before release. Verify the appropriate booking/deposit/cancellation and media/likeness/voice permissions for applicable services. Do not introduce new commercial terms such as arbitration, automatic renewal, or new fees without an owner decision.

Show applicable terms before commitment. Retain the exact accepted or signed text, version, hash, timestamp, customer/order reference, signature record where required, and retrievable customer copy. DIY acceptance and DWY/DFY signatures are distinct requirements in the existing brief. Review required policy pages and their links with the same process.

**Full skills in the PDFs**

For each product, build a coverage table: promised skill → canonical source file and revision → guide section/PDF page → required downloadable assets → reproducible procedure → expected output and troubleshooting. Locate the real skill sources in the repos/server; a missing result in one search is not proof a skill does not exist. Include complete customer-usable instructions and permitted templates/prompts/assets for every promised skill. Keep internal secrets and unrelated private material out of deliverables.

Where coverage is missing, update the canonical guide source, regenerate the PDF, and visually inspect every page for clipping, illegible screenshots, broken links, and missing sections. Verify the exact generated artifact is the one buyers receive, with a recorded version/hash. Check substantive legal/financial instructions against current authoritative sources and the existing review process before release.

Current review limitation: extracted PDF text was read, but raw PDF retrieval failed, so no page-render or visual PDF QA is claimed. Full skill-to-guide parity remains unverified.

**Scene-based carousels and text posts**

Carry forward Rexx's direction: when the meaning of the text changes, the visual should change to the corresponding scene from the approved video or production. Each carousel slide pairs one clear idea with a frame that demonstrates it. For animated text posts, time the scene change to the relevant phrase. The visual should help the audience recognize the connection, rather than merely decorate the words.

Record each beat's copy, source asset/revision, frame or timecode, intended connection, crop, and text placement in the existing content package. Keep text readable, use the approved brand, and preserve ONE COPY. Reuse approved footage; do not reintroduce rejected walking footage or expose private information visible in screen recordings. Preserve the approved audio and CTA where applicable. Review a complete example before scaling this treatment across future content.

**Release evidence**

Return an inventory with working / blocked / not tested status for each journey, concrete fixes and reviewable diffs, mobile and desktop screenshots, explainer playback checks, source-to-PDF coverage results, controlled checkout/delivery/booking/signing evidence, and remaining owner or reviewer decisions. For Bizbox code changes, run the required `npx vite build` and visually inspect the result. Reconcile existing PRs rather than opening duplicate work.

Do not call the merch store or customer journey done until these checks pass against the deployed version. This document records the implementation scope and first source findings; it does not claim the site, scheduler authentication, agreements, or PDFs have been fixed or deployed.
