// Explainer 02 Studios: build the .otio/.edl for a cut from the six cards on Drive.
//   node projects/explainers/02-studios/build-timeline.mjs ROUGH-01 [--vo]
// Working plan = EXPLAINER-02-STUDIOS-SHOT-SHEET-2026-09-24.html (48 s, 9:16 1080x1920, 24 fps):
// S01 8.0 · S02 7.0 · S03 8.0 · S04 8.0 · S05 9.0 · S06 8.0. Each card is assembled from its
// sub-shots by 02-studios/tools/assemble-cards.sh; the status table below records what is real,
// what is a stated fallback (a held real frame) and what is a placeholder, plus the Effects /
// Treatment fields Rexx asked for on every shot (2026-09-24) — none applied yet.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { buildTimeline, buildEdl, RATE } from '../../../tools/otio.mjs';

const version = process.argv[2] || 'ROUGH-01';
const VO = process.argv.includes('--vo');
const DRIVE = 'G:/My Drive/00_PROJECTS/EXPLAINERS/02-studios';
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').toUpperCase();
const nframes = p => +JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v', '-show_entries', 'stream=nb_read_frames', '-of', 'json', p], { encoding: 'utf8' })).streams[0].nb_read_frames;
const f = s => Math.round(s * RATE);
const T = (treatment, engine = 'none yet') => ({ treatment, engine, template: null, aeProject: null, comp: null, inputs: null, output: null, status: 'not applied', reusable: null, version: 0 });

const SHOTS = [
  { id: 'S01', title: 'THE FRICTION', seconds: 8.0, line: "Somebody books. Then they don't show. You held that hour.", sub: [
    { id: 'S01a', status: 'real', src: 'source/public/S01a.mp4', what: 'demo-massage: date picked, 10:00 AM slot clicked (phone layout, drawn pointer)' },
    { id: 'S01b', status: 'fallback', src: 'cards/S01b-fallback-hold.mp4', what: 'sheet fallback: the picked slot held 4.5 s', needs: 'film the empty treatment chair by a window, phone face-up (4.5 s)' }], treatment: T('none — real UI carries it') },
  { id: 'S02', title: 'YOUR OWN PHOTOS', seconds: 7.0, line: 'Your own photos go up to your Google Drive.', sub: [
    { id: 'S02a', status: 'real', src: 'source/public/S02a.mp4', what: '/studios/start heading held' },
    { id: 'S02b', status: 'placeholder', src: 'cards/S02b.mp4', needs: 'Google Drive login for the test account; drag 6–8 prop photos into a folder named Studio' }], treatment: T('none') },
  { id: 'S03', title: 'AGENTS SORT THE GAPS', seconds: 8.0, line: 'Agents sort them. Services. Hours. The gaps between clients.', sub: [
    { id: 'S03a', status: 'placeholder', src: 'cards/S03a.mp4', needs: 'same Drive folder: files moving into Services · Hours · Photos' },
    { id: 'S03b', status: 'visualization', src: '../01-bizbox/overlays/s03-abstract-insert_blender_1s.mp4', what: 'Blender insert (BizBox version until the day-bar variant renders), labeled Visualization' },
    { id: 'S03c', status: 'real', src: 'source/public/S03c.mp4', what: 'slot grid with the 12:15–1:45 gap, slow scroll' }], treatment: T('Agent 1–4 status cards, labeled Visualization', 'html2clip overlay (02-studios/overlays/agent-cards.html)') },
  { id: 'S04', title: 'YOUR LUNCH STAYS', seconds: 8.0, line: 'Your day gets built in. Your lunch stays your lunch.', sub: [
    { id: 'S04a', status: 'real', src: 'source/public/S04a.mp4', what: 'the user tries 1:00 PM; the disabled slot does not take the click' },
    { id: 'S04b', status: 'fallback', src: 'cards/S04b-fallback-hold.mp4', what: 'sheet fallback: the refused click held 4 s', needs: 'film the lunch on the side table, phone face-down (4 s)' }], treatment: T('none') },
  { id: 'S05', title: 'VERIFY. PREPAY. REMINDERS.', seconds: 9.0, line: 'A booking page. Clients verify, prepay, and get reminders.', sub: [
    { id: 'S05a', status: 'real', src: 'source/public/S05a.mp4', what: 'booking page top, slow scroll' },
    { id: 'S05b', status: 'real', src: 'source/public/S05b.mp4', what: '"This is my first visit" is on by default; the user ticks the terms box under the verify sentence' },
    { id: 'S05c', status: 'real', src: 'source/public/S05c.mp4', what: 'demo-bridal quote + "Send my request" — stopped on the button, never clicked' }], treatment: T('none') },
  { id: 'S06', title: 'END RESULT', seconds: 8.0, line: 'BizBox Studios. You get paid the morning after each session.', sub: [
    { id: 'S06a', status: 'fallback', src: 'source/public/S06a.mp4', what: 'sheet fallback: /studios hero held', needs: 'film the tidied room, morning light (4.5 s)' },
    { id: 'S06b', status: 'visualization', src: 'cards/S06b.mp4', what: 'end card "BizBox Studios · Try it free · biz-box.io/lyfe" over the held hero', needs: 'the payout screen when /studios/dashboard exists' }], treatment: T('end card', 'html2clip overlay (02-studios/overlays/end-card.html)') },
];

const clips = SHOTS.map(s => {
  const file = `${DRIVE}/cards/${s.id}${VO ? '-vo' : ''}.mp4`;
  if (!fs.existsSync(file)) throw new Error('missing ' + file);
  const duration = nframes(file);
  if (duration !== f(s.seconds)) s.stretched = `${s.seconds} s planned → ${(duration / RATE).toFixed(2)} s`;
  const st = s.sub.map(x => `${x.id}:${x.status}`).join(' ');
  return { name: `${s.id} ${s.title} [${st}${VO ? ' +vo' : ''}]`, file, start: 0, duration, available: duration, sha256: sha(file), note: st + (s.stretched ? ' · ' + s.stretched : '') };
});
const total = clips.reduce((a, c) => a + c.duration, 0);
for (const s of SHOTS) if (s.stretched) console.log(`  ${s.id}: ${s.stretched}`);

const name = `EXPLAINER-02-STUDIOS-${version}`;
const tl = buildTimeline(name, clips, { width: 1080, height: 1920, explainer: '02-studios', version, shotSheet: 'EXPLAINER-02-STUDIOS-SHOT-SHEET-2026-09-24.html (working plan, owner 2026-09-24)', voice: VO ? 'namesrexx clone, eleven_v3, zero tags — rough-cut takes, Rexx picks finals' : 'not laid in', builtAt: new Date().toISOString() });
fs.mkdirSync(path.join(here, 'timelines'), { recursive: true });
fs.writeFileSync(path.join(here, 'timelines', name + '.otio'), JSON.stringify(tl, null, 2) + '\n');
fs.writeFileSync(path.join(here, 'timelines', name + '.edl'), buildEdl(name, clips) + '\n');
fs.writeFileSync(path.join(here, 'timelines', name + '.SHOT-STATUS.json'), JSON.stringify({ name, seconds: total / RATE, shots: SHOTS.map((s, i) => ({ ...s, frames: clips[i].duration, sha256: clips[i].sha256 })) }, null, 2) + '\n');
const count = st => SHOTS.flatMap(s => s.sub).filter(x => x.status === st).length;
console.log(`${name}: ${clips.length} cards, ${total} frames = ${(total / RATE).toFixed(2)} s; sub-shots real ${count('real')}, fallback ${count('fallback')}, visualization ${count('visualization')}, placeholder ${count('placeholder')}`);
