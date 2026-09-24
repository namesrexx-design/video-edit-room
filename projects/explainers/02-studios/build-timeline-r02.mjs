// Explainer 02 Studios ROUGH-02 (16:9, beat-level): build the .otio/.edl from the beat cards' manifest.
//   node projects/explainers/02-studios/build-timeline-r02.mjs [ROUGH-02]
// The cards are cut by 02-studios/tools/assemble-rough02.mjs on Drive (FFmpeg), one per narration beat,
// each exactly as long as its take plus a breath. This file is the Studio record of that cut.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { buildTimeline, buildEdl, RATE } from '../../../tools/otio.mjs';

const version = process.argv[2] || 'ROUGH-02';
const DRIVE = 'G:/My Drive/00_PROJECTS/EXPLAINERS/02-studios';
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').toUpperCase();
const m = JSON.parse(fs.readFileSync(`${DRIVE}/cards16/MANIFEST.json`, 'utf8'));

const clips = m.beats.map(b => {
  const file = `${DRIVE}/${b.file}`;
  if (!fs.existsSync(file)) throw new Error('missing ' + file);
  return { name: `${b.id} [${b.status}] ${b.vo.slice(0, 40)}`, file, start: 0, duration: b.frames, available: b.frames, sha256: sha(file), note: `${b.source}${b.overlay ? ' + ' + b.overlay : ''} · take ${b.take || '-'} (${b.takeSeconds}s)` };
});
const total = clips.reduce((a, c) => a + c.duration, 0);
const name = `EXPLAINER-02-STUDIOS-${version}`;
const tl = buildTimeline(name, clips, { width: 1920, height: 1080, explainer: '02-studios', version, beatScript: m.beatScript, assembledWith: m.assembledWith, voice: 'namesrexx clone, eleven_v3, zero tags — rough-cut takes (shortest clean), Rexx picks finals', builtAt: new Date().toISOString() });
fs.mkdirSync(path.join(here, 'timelines'), { recursive: true });
fs.writeFileSync(path.join(here, 'timelines', name + '.otio'), JSON.stringify(tl, null, 2) + '\n');
fs.writeFileSync(path.join(here, 'timelines', name + '.edl'), buildEdl(name, clips) + '\n');
fs.writeFileSync(path.join(here, 'timelines', name + '.BEATS.json'), JSON.stringify(m, null, 2) + '\n');
const n = s => m.beats.filter(b => b.status.startsWith(s)).length;
console.log(`${name}: ${clips.length} beats, ${total} frames = ${(total / RATE).toFixed(2)} s, 1920x1080; real ${n('real')}, visualization ${n('visualization')}, placeholder ${n('placeholder')}, end card ${n('end')}`);
