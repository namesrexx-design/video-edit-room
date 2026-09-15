# LYFE Studio (Video Edit Room)

**LYFE Studio** is the product name (Rexx, 2026-09-15). The Cut Room is the editor; the Storyboard is a second feature holding every scene, character, set and object.

One place where a video is **built as a text timeline**, rendered by one script, and
opened by a person in a real editor when the agents can't.

**Product intent (Rexx, 2026-09-14):** this is not only our internal tool. It is meant to
become something BizBox customers use: their video is a timeline they can open and change,
not a file they have to ask for.

```
projects/<video>/
  MEDIA-MANIFEST.json     every clip: where it lives (D: and Drive), sha256, frame count
  timelines/*.otio        THE CUT. OpenTimelineIO JSON. This is what gets edited.
  timelines/*.edl         same cut as a plain CMX3600 EDL (fallback import for any editor)
  renders/RECEIPTS/*.json what was rendered, from which timeline, with hashes
tools/
  render.mjs              the only renderer:  node tools/render.mjs <timeline.otio> [out.mp4]
  otio.mjs                reads/writes the timeline format
  timeline-from-bin.mjs   one-time: numbered clip folder -> first timelines + manifest
```

Media (mp4, wav) is **never** committed. It lives on `D:\REXX\AI_Video\...` and on the Drive
mirror named in the manifest. The timeline points at the D: paths; the manifest lets any
machine relink by hash.

## Open and edit it yourself (DaVinci Resolve, free, already installed)

1. Open Resolve, make or open a project, set the timeline to 1920x1080, 24 fps.
2. **File > Import > Timeline** and pick `projects/garage-dream/timelines/GARAGE-DREAM-V74-PLUS-7.otio`.
   Resolve links every clip from the paths inside the file. If it asks, point it at
   `D:\REXX\AI_Video\BizBox-Garage-Dream\garage-through-apu-review\capcut-kit-v74\SCENES_IN_ORDER`.
3. Move, trim, delete. The seven `ADD-BACK-FROM-V36` clips are the scenes not in V74.
4. **File > Export > Timeline** as OTIO into the same `timelines/` folder with a new name
   (`GARAGE-DREAM-V75.otio`). Never overwrite an existing timeline.
5. Commit, or drop the file in the Drive `EDIT_ROOM` folder, and any agent renders it:

```bash
node tools/render.mjs projects/garage-dream/timelines/GARAGE-DREAM-V75.otio
```

If OTIO import ever fails, import the `.edl` next to it and relink to the same folder.

## Phone edits (CapCut)

CapCut cannot read a timeline file. Use the numbered clip folder on Drive
(`CAPCUT_KIT_V74\SCENES_IN_ORDER`): import the folder, select all, add to timeline, delete
what you don't want. Tell an agent the final clip order and it writes the timeline.

## Rules

- **A cut is a timeline file.** Nobody hand-writes a per-version ffmpeg script again.
- **The renderer never overwrites.** New cut = new timeline name = new render + receipt.
- **Renders are checked**: exact frame count, full decode, black-frame scan, media hashes.
- **Nothing is deleted.** Superseded files go to a `_superseded` folder.

## Proven

`GARAGE-DREAM-V74.otio` rendered back through `tools/render.mjs` was compared with the
original V74 file over all 2,764 frames: SSIM 0.991 (re-encode only), sound difference
-57 dB (a one-frame slip would read -20 dB). Receipt in `renders/RECEIPTS/`.
