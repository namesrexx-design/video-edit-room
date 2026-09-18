---
name: preserve-image-fidelity
description: Preserve approved identity, real brand artwork, fine material detail, and readable typography when making or refining Rexx's still images, product renders, hero banners, or subtle loops. Use for every BizBox or LYFE still-image task and before animating an approved still; inspect original references and delivery-size crops rather than relying on upscale claims.
---

# Preserve image fidelity

Treat an approved composition as a locked master. Make the requested change without silently replacing another accepted feature. Read `references/lyfe-hero.md` only for the LYFE warehouse hero; do not impose that outfit or room on unrelated images.

## Establish the source of truth

- Inspect the latest approved image and the original logo, garment artwork, embroidery macro, footwear, and product references relevant to the edit. Use original files, not screenshots of earlier generated approximations.
- Record each authoritative source, approved version, intended output dimensions, and requested changes. Resolve contradictions using the latest explicit user correction. If an essential reference cannot be retrieved, name the missing reference; do not invent a substitute and label it authentic.
- Preserve identity, skin tone, pose, expression, clothing construction, accessory geometry, and placement unless the request changes them. Real embroidery must follow the real mark, including thread direction, raised thread, corduroy ribs, color separation, and small-logo scale.
- Keep original artwork as a vector, high-resolution texture, or masked photographic layer. Repeatedly regenerating a shirt print or logo introduces drift. Use the available image editing tool when appropriate and follow its requirements; for an explicitly requested Blender workflow, build geometry and materials around original reference assets.

## Build detail at its source

- Use layered sources: room and physical relief in Blender when requested; original reference artwork for texture; vector or native page text for labels; a separate subject layer when no real 3D likeness exists. Describe a photo composite as such.
- Distinguish emitting surfaces from reflected light. For backlit signage, opaque fronts stay opaque and rear emitters illuminate the wall. Let geometry produce corners, wall-floor junctions, occlusion, contact shadows, and relief. Avoid painted lighting that implies a nonexistent source.
- Make enlarged type from vectors or font outlines; do not sharpen raster text and call it reconstructed. Keep body type readable at its actual page size. Preserve font licenses in source packages.
- Treat native scene sampling, raster source resolution, and exported dimensions as three separate facts. A 16K export cannot recover a photographed face or shoe detail absent from its source. Never promise unlimited zoom or call interpolated pixels authentic detail.

## Verify the actual output

- Decode the completed export, not a stale preview. Check the full composition and crops of face, embroidery, shirt print, footwear, product mark, lettering, relief edges, and room junctions as relevant.
- Inspect at intended display size and 100% pixels. When 600% is requested, provide a clearly labeled enlarged crop and distinguish inspection zoom from the native master pixels. Check for halos, damaged alpha edges, blotches, warped glasses, missing logo components, color drift, and contradictory shadows.
- For matching product sets, enforce one palette mapping across corresponding hat/mug/shirt colorways; order darkest to lightest when requested. Do not recolor an individually approved outfit because a catalog uses a different mapping.
- Preserve the prior approved master. Save an editable source and a lossless still plus the appropriate web derivative; identify any lossy conversion. Supply an inline preview and an honest account of what was actually inspected. Follow the environment's durable-save and repository rules.

## Animate only what is authorized

- Start with deterministic local animation or layered compositing when the user requires the same look. Keep camera, text, logos, outfit, and facial identity fixed. Do not regenerate the whole frame merely to pulse one lamp.
- Inspect the eyes before promising gaze animation. Closed eyes have no visible pupils to move; preserve them and explain that opening them changes the expression. Do not warp eyelids, glasses, or the whole face as a substitute for iris movement.
- For a slow luminous pulse, use a continuous periodic curve; animate the emitting face and corresponding wall spill together, with consistent occlusion. Keep unrelated painted faces and ambient lighting fixed. Do not claim a composited pulse is a fully rerendered physical light simulation.
- Prefer a full-color video or layered web animation over a palette-limited GIF for photographic detail. Keep the lossless static master available. Do not call a lossy delivery video lossless or promise 600% sharpness at every device resolution.
- Check several phases, frame count, output dimensions, and the last-to-first transition. Verify unchanged areas against the approved base before encoding; inspect an encoded frame for color/text degradation. Use a static poster and honor reduced-motion settings when integrating into a website.

## Make the standard discoverable

A personal skill does not automatically install itself into Claude or other agents. For cross-agent use, place the same standard in the authorized shared repository and reference it from that repository's agent entrypoints. Follow its review/merge gates. State exactly which installation is active and which changes await merge; never claim every agent has adopted a draft.
