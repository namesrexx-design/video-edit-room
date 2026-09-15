// One-time: turn the numbered V74 scene bin into the first two timelines + the media manifest.
//   node tools/timeline-from-bin.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { buildTimeline, buildEdl } from './otio.mjs';

const BIN = 'D:/REXX/AI_Video/BizBox-Garage-Dream/garage-through-apu-review/capcut-kit-v74/SCENES_IN_ORDER';
const DRIVE = 'G:/My Drive/00_PROJECTS/AUTOPILOT/Video 04 - Garage Dream - IN PRODUCTION/CAPCUT_KIT_V74/SCENES_IN_ORDER';
const PROJ = path.resolve('projects/garage-dream');
fs.mkdirSync(PROJ + '/timelines', { recursive: true });

const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').toUpperCase();
const nframes = p => +JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'json', p], { encoding: 'utf8' })).streams[0].nb_read_frames;

const files = fs.readdirSync(BIN).filter(f => /^\d\d_.*\.mp4$/.test(f)).sort();
const manifest = files.map(f => {
  const p = `${BIN}/${f}`; const frames = nframes(p);
  return { file: f, local: p, drive: `${DRIVE}/${f}`, sha256: sha(p), frames, seconds: +(frames / 24).toFixed(3), addBack: /ADD-BACK/.test(f), scene: f.split('_')[1] };
});
fs.writeFileSync(PROJ + '/MEDIA-MANIFEST.json', JSON.stringify({ note: 'Media is NOT in git. Same bytes on D: (local) and Drive. Relink by sha256.', rate: 24, clips: manifest }, null, 2));

const clip = m => ({ name: m.file.replace(/\.mp4$/, ''), file: m.local, start: 0, duration: m.frames, available: m.frames, sha256: m.sha256 });
const write = (name, clips, meta) => {
  const tl = buildTimeline(name, clips, meta);
  fs.writeFileSync(`${PROJ}/timelines/${name}.otio`, JSON.stringify(tl, null, 2));
  fs.writeFileSync(`${PROJ}/timelines/${name}.edl`, buildEdl(name, clips));
  const total = clips.reduce((s, c) => s + c.duration, 0);
  console.log(`${name}: ${clips.length} clips, ${total} frames, ${(total / 24).toFixed(3)} s`);
};
write('GARAGE-DREAM-V74', manifest.filter(m => !m.addBack).map(clip), { base: 'GARAGE-DREAM-V74-CANDIDATE-CLAUDE-2026-09-14.mp4 sha E83ECC08…, split at its shot changes' });
write('GARAGE-DREAM-V74-PLUS-7', manifest.map(clip), { base: 'V74 with the seven finished V36 scenes slotted back in story order' });
