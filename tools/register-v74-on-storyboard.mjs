// Owner decision 2026-09-14: V74 candidate is the base cut. Register it on Codex's storyboard:
// every scene that is in V74 gets a `v74` block pointing at its exact clip; currentFullCut,
// currentAssembly and restartCheckpoint move to V74. Backup first, never delete.
import fs from 'node:fs';
const W = 'C:/Users/16263/Documents/Codex/2026-09-04/referenced-chatgpt-conversation-this-is-an-2';
const SB = W + '/scene-board/storyboard.json';
const KIT = 'D:/REXX/AI_Video/BizBox-Garage-Dream/garage-through-apu-review/capcut-kit-v74/SCENES_IN_ORDER';
const V74 = 'D:/REXX/AI_Video/BizBox-Garage-Dream/garage-through-apu-review/full-working-cut/GARAGE-DREAM-V74-CANDIDATE-CLAUDE-2026-09-14.mp4';
const receipt = JSON.parse(fs.readFileSync('projects/garage-dream/renders/RECEIPTS/GARAGE-DREAM-V74.mp4.receipt.json', 'utf8'));
const manifest = JSON.parse(fs.readFileSync('projects/garage-dream/MEDIA-MANIFEST.json', 'utf8'));

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
fs.copyFileSync(SB, `${SB}.bak-${stamp}-pre-v74`);
fs.copyFileSync(W + '/scene-board/board-data.js', `${W}/scene-board/board-data.js.bak-${stamp}-pre-v74`);
const b = JSON.parse(fs.readFileSync(SB, 'utf8'));

// clip -> scenes, episode frame ranges from the V74 receipt (items in order)
const SCENES = { '01': ['S01'], '02': ['S02'], '03': ['S03'], '04': ['S04'], '05': ['S05'], '06': ['S06'], '07': ['S07'], '09': ['S09'], '10': ['S10'], '15': ['S14', 'S16'], '16': ['S17'], '17': ['S18'], '18': ['S19'], '21': ['S23'], '22': ['S24'], '23': ['S27'], '24': ['S28', 'S29'] };
let f = 0; const bySceneId = {};
for (const it of receipt.items) {
  const id = it.file.slice(0, 2); const m = manifest.clips.find(c => c.file === it.file);
  const block = { clip: `${KIT}/${it.file}`, driveClip: m.drive, sha256: m.sha256, episodeFrames: [f, f + it.frames], episodeSeconds: [+(f / 24).toFixed(6), +((f + it.frames) / 24).toFixed(6)], sharedWith: SCENES[id].length > 1 ? SCENES[id] : undefined };
  for (const s of SCENES[id]) bySceneId[s] = block;
  f += it.frames;
}
if (f !== receipt.frames) throw new Error('frame walk mismatch');

let touched = 0;
for (const s of b.scenes) {
  const v = bySceneId[s.id];
  if (v) { s.v74 = { ...v, registeredAt: new Date().toISOString(), by: 'Claude (MASTER) at owner request' }; s.start = v.episodeSeconds[0]; s.end = v.episodeSeconds[1]; touched++; }
  else if (['S08', 'S11', 'S12', 'S13', 'S15', 'S20', 'S21', 'S22'].includes(s.id)) s.v74 = { inCut: false, note: 'Not in V74. Finished V36 footage is parked in the Cut Room / CAPCUT_KIT_V74 as an ADD-BACK clip; owner decides.', registeredAt: new Date().toISOString() };
}
b.currentAssembly = '../garage-through-apu-review/full-working-cut/GARAGE-DREAM-V74-CANDIDATE-CLAUDE-2026-09-14.mp4';
b.currentFullCut = { ...b.currentFullCut, title: 'V74 — owner-selected base (2026-09-14)', file: b.currentAssembly, duration: receipt.seconds, status: 'Owner picked V74 as the base after V73 review. Every later change is a new timeline in the Video Edit Room (github.com/namesrexx-design/video-edit-room), rendered from projects/garage-dream/timelines/*.otio. No per-version assembly scripts.', sha256: 'E83ECC082C397E53EFC5DB32DE63CE237FAC646F5BFBF583B8FADF16B87325FB', frames: receipt.frames, registeredBy: 'Claude (MASTER)', registeredAt: new Date().toISOString(), previous: { title: 'V73 — reviewed; corrections in progress', file: '../garage-through-apu-review/full-working-cut/GARAGE-DREAM-V73-FINAL-FIXES.mp4' } };
b.restartCheckpoint = { ...b.restartCheckpoint, status: 'V74_OWNER_BASE_REGISTERED', date: new Date().toISOString(), mainCut: 'V74', file: b.currentAssembly, sha256: 'e83ecc082c397e53efc5db32de63ce237fac646f5bfbf583b8fadf16b87325fb', frames: receipt.frames, durationSeconds: receipt.seconds, editRoom: 'https://github.com/namesrexx-design/video-edit-room' };
b.editRoom = { repo: 'https://github.com/namesrexx-design/video-edit-room', timelines: 'projects/garage-dream/timelines/', renderer: 'node tools/render.mjs <timeline.otio>', cutRoomPage: 'https://claude.ai/artifact/6uQh9o2LcpjCorpXKfEi7e', rule: 'A cut is a timeline file. Nobody hand-writes a per-version assembly script again.' };

fs.writeFileSync(SB, JSON.stringify(b, null, 2) + '\n');
fs.writeFileSync(W + '/scene-board/board-data.js', 'window.REXX_BOARD = ' + JSON.stringify(b, null, 2) + ';\n');
console.log(`registered V74 on ${touched} scenes; currentFullCut -> V74; backups: storyboard.json.bak-${stamp}-pre-v74`);
