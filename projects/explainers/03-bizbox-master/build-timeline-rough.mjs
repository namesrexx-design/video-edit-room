// BizBox master film — rough-cut timeline from the prepared segments (board v2, 94.5 s).
//   node projects/explainers/03-bizbox-master/build-timeline-rough.mjs ROUGH-02
//   node tools/render.mjs projects/explainers/03-bizbox-master/timelines/BIZBOX-MASTER-ROUGH-02.otio <out.mp4>
// Segments are composited upstream (caption + status tag burned in) by
// Drive 03-bizbox-master/tools/prep-rough.mjs; this file only orders them. tools/render.mjs does the
// assembly, frame-count / decode / black-frame QC and the receipt — the one renderer.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildTimeline, buildEdl } from '../../../tools/otio.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const version = process.argv[2] || 'ROUGH-02';
const DRIVE = 'G:/My Drive/00_PROJECTS/EXPLAINERS/03-bizbox-master';
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').toUpperCase();
const m = JSON.parse(fs.readFileSync(`${DRIVE}/rough/${version}/segments.json`, 'utf8'));

const clips = m.beats.map((b) => {
  if (!fs.existsSync(b.file)) throw new Error('missing ' + b.file);
  return { name: `${b.id} [${b.kind}] ${String(b.vo).slice(0, 40)}`, file: b.file, start: 0, duration: b.frames, available: b.frames, sha256: sha(b.file), note: `${b.status} · ${b.source}` };
});
const total = clips.reduce((a, c) => a + c.duration, 0);
if (total !== m.frames) throw new Error(`timeline ${total} frames, manifest says ${m.frames}`);

const name = `BIZBOX-MASTER-${version}`;
const tl = buildTimeline(name, clips, { width: 1920, height: 1080, explainer: '03-bizbox-master', version, board: m.board, assembledWith: 'prep-rough.mjs segments (FFmpeg composite) + video-edit-room tools/render.mjs', motion: 'motion-kit engine, MIT (Barty-Bart/motion-graphics e8d610a), vendored in Drive tools/motionkit', audio: 'none — VO shown as scratch captions' });
fs.mkdirSync(path.join(here, 'timelines'), { recursive: true });
fs.writeFileSync(path.join(here, 'timelines', name + '.otio'), JSON.stringify(tl, null, 2) + '\n');
fs.writeFileSync(path.join(here, 'timelines', name + '.edl'), buildEdl(name, clips) + '\n');
console.log(`${name}: ${clips.length} clips, ${total} frames = ${(total / 24).toFixed(3)} s → timelines/${name}.otio`);
