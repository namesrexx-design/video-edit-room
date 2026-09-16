// pass15-final-pass.mjs — STORYBOARD-FINAL pass 15 from Codex's owner-correction deliveries (PR #19). 2026-09-16
//
// Owner corrections carried by these clips (quoted in the PR READMEs):
//   1:39  "that should be his voice saying yeah he opened two months ago"   → S27 Homer clip replaces INV051
//   1:51  "redo the video clip with them just nodding their head while im talking" → S28 nodding clip replaces INV008
//   2:00  "homers lip move out of nowhere"                                   → S29 silent listeners replaces INV009
//   "the double fist bump scene needs a new start and end frame"            → one clean bump before Apu's goodbye line;
//          the line's own opening bump (frames 0-5) is cut from the picture, and its sound starts 6 frames early
//          (J-cut over the end of the bump) so the lips stay in sync and "Alright" is not clipped.
// Every sound linked to a moved block moves with it; unlinked sounds after an edit ripple with the block they sat in.
import fs from 'node:fs';

const F = 'projects/garage-dream/cuts/STORYBOARD-FINAL.json';
const KEEP = 'projects/garage-dream/cuts/STORYBOARD-FINAL-pass14.json';
const NEW = 'final-pass-20260916';
const cut = JSON.parse(fs.readFileSync(F, 'utf8'));
if (cut.v1.some((b) => b.u === 'sb_s29bump')) { console.log('pass 15 already applied'); process.exit(0); }
if (!fs.existsSync(KEEP)) fs.writeFileSync(KEEP, JSON.stringify(cut, null, 1));

const starts = (v1) => { const m = {}; let t = 0; for (const b of v1) { m[b.u] = t; t += b.end - b.start; } return { m, total: t }; };
const before = starts(cut.v1);
const byU = (u) => { const b = cut.v1.find((x) => x.u === u); if (!b) throw new Error('no block ' + u); return b; };
const a2 = (link) => { const s = cut.a2.find((x) => x.link === link); if (!s) throw new Error('no sound for ' + link); return s; };

// 1:39 Homer's line
Object.assign(byU('sb_s27c'), { id: 'S27-HOMER', file: 'S27-COMPLETE-homer-two-months-timed-voice-v1.mp4', folder: NEW, start: 0, end: 52, note: 'Homer: Yeah, he opened it two months ago (Codex PR #19, owner correction 1:39)' });
Object.assign(a2('sb_s27c'), { id: 'S27-HOMER-sound', file: 'S27-COMPLETE-homer-two-months-timed-voice-v1.mp4', folder: NEW, start: 0, end: 52, gain: 0 });

// 1:51 nodding under Rexx's reminder
Object.assign(byU('sb_s28'), { id: 'S28-NOD', file: 'S28-COMPLETE-closed-mouth-nodding-v2.mp4', folder: NEW, start: 0, end: 86, note: 'Rexx: take the photos, Homer — Homer and Apu nod, mouths closed (Codex PR #19, owner correction 1:51)' });
Object.assign(a2('sb_s28'), { id: 'S28-NOD-sound', file: 'S28-COMPLETE-closed-mouth-nodding-v2.mp4', folder: NEW, start: 0, end: 86, gain: 0 });

// 2:00 silent listeners under "He's talking about the blood on your forehead"
Object.assign(byU('sb_s29d'), { id: 'S29-LISTEN', file: 'S29-COMPLETE-silent-listeners-with-rexx-line-v2.mp4', folder: NEW, start: 0, end: 46, note: 'Rexx: the blood on your forehead — Homer and Apu listen, mouths closed (Codex PR #19, owner correction 2:00)' });
Object.assign(a2('sb_s29d'), { id: 'S29-LISTEN-sound', file: 'S29-COMPLETE-silent-listeners-with-rexx-line-v2.mp4', folder: NEW, start: 0, end: 46, gain: 0 });

// one fist bump, then Apu's goodbye with its own bump cut out of the picture
const i43 = cut.v1.findIndex((b) => b.u === 'sb_s29a');
cut.v1.splice(i43, 0, { u: 'sb_s29bump', id: 'S29-BUMP', scene: 'S29', file: 'S29-COMPLETE-single-bump-clean-handoff-v3.mp4', folder: NEW, start: 0, end: 51, mute: true, note: 'One clean fist bump (Codex PR #19, owner: double fist bump needs a new start and end)' });
const TRIM = 6;
byU('sb_s29a').start = TRIM; byU('sb_s29a').note += ' — opening bump cut (frames 0-5), sound J-cut';

const after = starts(cut.v1);
// where did each old frame go? (for unlinked sounds)
const oldBlocks = []; { let t = 0; for (const b of JSON.parse(fs.readFileSync(KEEP, 'utf8')).v1) { oldBlocks.push({ u: b.u, t0: t, t1: t + b.end - b.start }); t += b.end - b.start; } }
const shiftAt = (at) => { const ob = oldBlocks.find((o) => at >= o.t0 && at < o.t1) || oldBlocks[oldBlocks.length - 1]; return at + (after.m[ob.u] - before.m[ob.u]); };
for (const lane of ['a1', 'a2', 'v2']) for (const s of cut[lane] || []) {
  if (typeof s.at !== 'number') continue;
  if (s.link && after.m[s.link] != null) s.at = s.at - before.m[s.link] + after.m[s.link];
  else s.at = shiftAt(s.at);
}
// J-cut: Apu's line sound starts TRIM frames before his (trimmed) picture
a2('sb_s29a').at = after.m.sb_s29a - TRIM;

cut.frames = after.total;
cut.name = 'STORYBOARD-FINAL pass 15';
cut.savedAt = new Date().toISOString();
cut.note = (cut.note ? cut.note + ' | ' : '') + 'pass 15 (2026-09-16): Codex PR #19 owner corrections — Homer line 1:39, nodding 1:51, silent listeners 2:00, single fist bump.';
fs.writeFileSync(F, JSON.stringify(cut, null, 1));
console.log(`pass 15: ${before.total} → ${after.total} frames (${(after.total / 24).toFixed(2)} s)`);
let t = 0; for (const b of cut.v1) { const e = t + b.end - b.start; if (t / 24 > 95) console.log((t / 24).toFixed(2).padStart(7), '→', (e / 24).toFixed(2).padStart(7), b.id); t = e; }
for (const s of cut.a2) if (s.at / 24 > 95) console.log('   sound', (s.at / 24).toFixed(2).padStart(7), s.id, `${s.start}-${s.end}`);
