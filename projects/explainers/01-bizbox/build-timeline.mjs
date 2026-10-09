// Explainer 01 BizBox: build the .otio/.edl for a cut from the shot clips on Drive.
//   node projects/explainers/01-bizbox/build-timeline.mjs ROUGH-01
// Shot order, durations and sources follow the LOCKED shot sheet (EXPLAINER-01-BIZBOX-SHOT-SHEET-2026-09-23.html):
// S01 3.5 · S02 3.0 · S03 4.0 · S04 3.5 · S05 3.5 · S06 4.0 = 21.5 s, 9:16 1080x1920, 24 fps.
// A shot whose real source is not filmed/recorded yet points at its PLACEHOLDER card; the status
// table below is the record of what is real and what still needs Rexx (login, filming).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { buildTimeline, buildEdl, RATE } from '../../../tools/otio.mjs';

const version = process.argv[2] || 'ROUGH-01';
// --vo: use the cards with the voice line muxed in (cards/S0N-vo.mp4). Those cards are as long as
// the LONGER of the locked shot and the take, so the line is never cut; the total is reported
// against the locked 21.5 s instead of enforced.
const VO = process.argv.includes('--vo');
const DRIVE = 'G:/My Drive/00_PROJECTS/EXPLAINERS/01-bizbox';
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').toUpperCase();
const f = s => Math.round(s * RATE);

// status: real | composite | placeholder. "needs" = what unblocks the real shot.
const SHOTS = [
  { id: 'S01', title: 'THE FRICTION', seconds: 3.5, file: `${DRIVE}/cards/S01.mp4`, status: 'placeholder', needs: 'Rexx films the overhead desk shot (S01/S06 same setup)', line: 'My files were in one place. My tools were in another.' },
  { id: 'S02', title: 'UPLOAD', seconds: 3.0, file: `${DRIVE}/cards/S02.mp4`, status: 'placeholder', needs: 'Google Drive login for the test account; record the drag-and-drop', line: 'Everything goes into your own Google Drive. Photos. Documents.' },
  { id: 'S03', title: 'AGENTS', seconds: 4.0, file: `${DRIVE}/cards/S03.mp4`, status: 'composite', needs: 'Drive folder recording replaces the base card; overlay + 1 s Blender insert are final', line: 'Agents work above the folder. Reading. Sorting. Naming every file.' },
  { id: 'S04', title: 'NEXT STEP', seconds: 3.5, file: `${DRIVE}/cards/S04.mp4`, status: 'placeholder', needs: 'test account signed in to /workspace in a Playwright profile; record the scroll', line: 'The pile becomes projects. Each one with its own folder.' },
  { id: 'S05', title: 'CREATED / DONE', seconds: 3.5, file: `${DRIVE}/cards/S05.mp4`, status: 'placeholder', needs: 'same signed-in session; record the /workspace header hold', line: 'Now there is ONE workspace. Files, projects and agents together.' },
  { id: 'S06', title: 'END RESULT', seconds: 4.0, file: `${DRIVE}/cards/S06.mp4`, status: 'placeholder', needs: 'Rexx films the tidied desk, laptop open on /workspace; end card Try it free · biz-box.io/lyfe', line: 'That is BizBox. One place for the work.' },
];

const nframes = p => +JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v', '-show_entries', 'stream=nb_read_frames', '-of', 'json', p], { encoding: 'utf8' })).streams[0].nb_read_frames;
const clips = SHOTS.map(s => {
  const file = VO ? s.file.replace(/\.mp4$/, '-vo.mp4') : s.file;
  if (!fs.existsSync(file)) throw new Error('missing ' + file);
  const duration = VO ? nframes(file) : f(s.seconds);
  if (VO && duration !== f(s.seconds)) s.stretched = `${s.seconds} s locked → ${(duration / RATE).toFixed(2)} s to fit the take`;
  return { name: `${s.id} ${s.title} [${s.status}${VO ? ' +vo' : ''}]`, file, start: 0, duration, available: duration, sha256: sha(file), note: (s.status === 'placeholder' ? 'PLACEHOLDER: ' + s.needs : s.needs) + (s.stretched ? ' · ' + s.stretched : '') };
});
const total = clips.reduce((a, c) => a + c.duration, 0);
if (!VO && total !== f(21.5)) throw new Error(`cut is ${total} frames, the locked sheet is ${f(21.5)}`);
if (VO) for (const s of SHOTS) if (s.stretched) console.log(`  ${s.id}: ${s.stretched}`);

const name = `EXPLAINER-01-BIZBOX-${version}`;
const tl = buildTimeline(name, clips, { width: 1080, height: 1920, explainer: '01-bizbox', version, shotSheet: 'EXPLAINER-01-BIZBOX-SHOT-SHEET-2026-09-23.html (LOCKED)', voice: 'namesrexx clone, eleven_v3, zero tags — not yet laid in', builtAt: new Date().toISOString() });
fs.mkdirSync(path.join(here, 'timelines'), { recursive: true });
fs.writeFileSync(path.join(here, 'timelines', name + '.otio'), JSON.stringify(tl, null, 2) + '\n');
fs.writeFileSync(path.join(here, 'timelines', name + '.edl'), buildEdl(name, clips) + '\n');
fs.writeFileSync(path.join(here, 'timelines', name + '.SHOT-STATUS.json'), JSON.stringify({ name, seconds: total / RATE, shots: SHOTS.map((s, i) => ({ ...s, frames: clips[i].duration, sha256: clips[i].sha256 })) }, null, 2) + '\n');
console.log(`${name}: ${clips.length} shots, ${total} frames = ${total / RATE} s; real ${SHOTS.filter(s => s.status === 'real').length}, composite ${SHOTS.filter(s => s.status === 'composite').length}, placeholder ${SHOTS.filter(s => s.status === 'placeholder').length}`);
