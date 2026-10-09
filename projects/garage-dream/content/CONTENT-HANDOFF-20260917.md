# Garage Dream content handoff — 2026-09-17

Owner approved final audio V6 as “winner,” initially requested clips and supporting copy, then clarified no additional film clip work was needed. Latest request: see the still-based scrolling/carousel preview. No new character footage or still-image generation was used for supporting content.

Delivered for review: four 1080x1920 scrolling MP4s with continuous namesrexx / eleven_v3 narration (nonchalant, amused, warm and curious tags); four five-card 1080x1350 carousels; four matching photo/text posts; full-film caption and copy for each format; portable preview page and source-asset archive. Four V6 film excerpts were already completed before the owner paused that work, retained separately.

Selected voice IDs and generation receipts: VOICE-GENERATION-RECEIPT.json. Scrolling V2 exports: SCROLL-RENDER-RECEIPTS-20260917.json. 511 / 365 / 436 / 501 frames, all24fps. Full decode, frame counts and black scans passed; no black intervals. The first preview measured -17.84LUFS and -5.01dBTP. Selected voice takes were transcribed for script completeness and timed by spoken paragraphs; this is not a claim of human listening certification.

CONTENT-TYPES.json defines full_episode, optional story_clip, scrolling_text_voiceover, text_carousel, photo_text_post, text_post, and future talking_head_qa. One topic can yield multiple angles and multiple instances of every applicable type. Existing approved stills are the default; no scene regeneration is required for text formats. The format definitions are locked by owner instruction. New assets remain for owner review.

Canonical projects/garage-dream/source/storyboard.json now contains contentProduction with registry, campaign, copy and master-approval pointers. Prior source preserved at source/_backups/storyboard.before-content-types-20260917.json. Existing scene data and approvals were preserved. The generated board files were not hand-edited. This source change is on the draft branch; it is not a live board deployment. Nothing posted or scheduled; no PR merge or live cut promotion.

Final still-based rendering used the canonical render-cut.mjs in the available workspace after GitHub commits. The renderer now supports explicit even output dimensions and preserves full source framing; legacy defaults remain1920x1080. The owned studio server was not accessed (no key available here). Supporting layouts use editable native SVG text with the unchanged approved LYFE-readings-background-3840.png. Build/review scripts are in tools/. No further Higgsfield generation is needed to adjust typography or scroll timing.

Next: owner reviews the preview style/pace, then revise only requested typography/timing/copy. Do not make more film clips or new footage by default. Do not present formats as live until the PR is merged and the view is verified.
