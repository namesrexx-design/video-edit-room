// Build the Garage Dream INVENTORY: the recent Higgsfield videos (Kling, Minimax, edits) plus the
// V74 lip-sync videos, conformed to 1080p24 so any of them can drop straight into the cut.
// Also writes the web proxies + thumbs the Cut Room page uses, and inventory.json for the page.
//   node tools/build-inventory.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync, execFileSync } from 'node:child_process';

const HIGGS = 'D:/REXX/AI_Video/BizBox-Garage-Dream/higgsfield-recent-2026-09-15';
const CODEX = 'C:/Users/16263/Documents/Codex/2026-09-04/referenced-chatgpt-conversation-this-is-an-2';
const FWC = 'D:/REXX/AI_Video/BizBox-Garage-Dream/garage-through-apu-review/full-working-cut';
const OUT = 'D:/REXX/AI_Video/BizBox-Garage-Dream/inventory-v74';
const EDITOR = 'C:/Users/16263/AppData/Local/Temp/claude/C--Users-16263-Desktop-Claude-Code-Build/9d00f0c5-975e-4197-b36d-8f1eb6052b13/scratchpad/film/editor';
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(EDITOR + '/inv', { recursive: true }); fs.mkdirSync(EDITOR + '/thumbs', { recursive: true });

const run = a => { const r = spawnSync('ffmpeg', ['-v', 'error', '-nostdin', '-n', ...a], { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64e6 }); if (r.status !== 0) throw new Error('ffmpeg\n' + r.stderr.toString().slice(-800)); };
const probe = p => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', p], { encoding: 'utf8', maxBuffer: 64e6 }));
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').toUpperCase();
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);

// sources, newest Higgsfield first, then lip-sync
const higgs = JSON.parse(fs.readFileSync(HIGGS + '/higgs-recent-videos.json', 'utf8'));
const sources = [];
for (const r of higgs.filter(r => r.at >= '2026-09-14' && !/massage|studio/i.test(r.prompt || ''))) {  // today's only (owner, 2026-09-15)
  const f = fs.readdirSync(HIGGS).find(x => x.includes('_' + r.id.slice(0, 8) + '_') && x.endsWith('.mp4'));
  if (f) sources.push({ group: 'higgsfield', model: r.model, at: r.at, title: (r.prompt || '').slice(0, 90) || f, src: HIGGS + '/' + f });
}
for (const f of fs.readdirSync(CODEX + '/worker-lipsync-v74').filter(x => x.endsWith('.mp4')).sort()) sources.push({ group: 'lipsync', model: 'lipsync-v74', at: '2026-09-14', title: f.replace(/\.mp4$/, '').replace(/-/g, ' '), src: `${CODEX}/worker-lipsync-v74/${f}` });
for (const f of fs.readdirSync(FWC).filter(x => /LIPSYNC/i.test(x) && x.endsWith('.mp4') && !/^GARAGE-DREAM-V/.test(x)).sort()) sources.push({ group: 'lipsync', model: 'lipsync', at: '2026-09-13', title: f.replace(/\.mp4$/, '').replace(/-/g, ' '), src: `${FWC}/${f}` });

// Owner uploads (Rexx drops files in the Drive root; they are copied, never moved, into INCOMING_FROM_REXX/<date>).
const OWNER_IN = 'G:/My Drive/00_PROJECTS/AUTOPILOT/Video 04 - Garage Dream - IN PRODUCTION/EDIT_ROOM/INCOMING_FROM_REXX';
if (fs.existsSync(OWNER_IN)) for (const d of fs.readdirSync(OWNER_IN).sort()) for (const f of fs.readdirSync(`${OWNER_IN}/${d}`).filter(x => x.endsWith('.mp4')).sort()) sources.push({ group: 'owner', model: 'rexx-upload', at: d, title: f.replace(/.mp4$/, '').replace(/-/g, ' '), src: `${OWNER_IN}/${d}/${f}` });

// Astra handoff candidates (retrieved from Higgsfield history 2026-09-15; not approved)
const HANDOFF = 'D:/REXX/AI_Video/BizBox-Garage-Dream/astra-handoff-20260915/existing-candidates';
if (fs.existsSync(HANDOFF)) for (const f of fs.readdirSync(HANDOFF).filter(x => x.endsWith('.mp4')).sort()) sources.push({ group: 'handoff', model: 'candidate', at: '2026-09-15', title: f.replace(/.mp4$/, '').replace(/-/g, ' ') + ' (Astra handoff)', src: HANDOFF + '/' + f });

const TRIALS = 'D:/REXX/AI_Video/BizBox-Garage-Dream/astra-handoff-20260915/outputs';
if (fs.existsSync(TRIALS)) for (const f of fs.readdirSync(TRIALS).filter(x => x.endsWith('.mp4')).sort()) sources.push({ group: 'trial', model: 'kling3_0 pro', at: '2026-09-15', title: f.replace(/.mp4$/, '').replace(/-/g, ' ') + ' (new render, owner review)', src: TRIALS + '/' + f });

const manifest = []; let i = 0;
for (const s of sources) {
  i++; const id = 'INV' + String(i).padStart(3, '0'); const name = `${id}_${slug(path.basename(s.src, '.mp4'))}.mp4`; const dest = `${OUT}/${name}`;
  process.stdout.write(`${id} ${s.group.padEnd(10)} ${path.basename(s.src).slice(0, 60).padEnd(60)} `);
  try {
    const p = probe(s.src); const v = p.streams.find(x => x.codec_type === 'video'); const hasA = p.streams.some(x => x.codec_type === 'audio');
    if (!fs.existsSync(dest)) run(['-i', s.src, ...(hasA ? [] : ['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo']), '-map', '0:v:0', '-map', hasA ? '0:a:0' : '1:a:0', '-shortest', '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=24,setsar=1,format=yuv420p', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-fps_mode', 'cfr', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', dest]);
    const pd = probe(dest); const frames = +pd.streams.find(x => x.codec_type === 'video').nb_read_frames;
    if (!fs.existsSync(`${EDITOR}/inv/${id}.mp4`)) run(['-i', dest, '-vf', 'scale=960:540', '-c:v', 'libx264', '-preset', 'fast', '-b:v', '700k', '-maxrate', '900k', '-bufsize', '1800k', '-pix_fmt', 'yuv420p', '-g', '24', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', `${EDITOR}/inv/${id}.mp4`]);
    if (!fs.existsSync(`${EDITOR}/thumbs/${id}.jpg`)) run(['-ss', '0.5', '-i', dest, '-frames:v', '1', '-vf', 'scale=320:180', '-q:v', '4', `${EDITOR}/thumbs/${id}.jpg`]);
    manifest.push({ id, file: name, local: dest, source: s.src, sha256: sha(dest), frames, seconds: +(frames / 24).toFixed(3), group: s.group, model: s.model, at: s.at, title: s.title, sourceSize: `${v.width}x${v.height}@${v.r_frame_rate}`, sourceHadAudio: hasA });
    console.log('ok', frames, 'f');
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); manifest.push({ id, source: s.src, failed: true }); }
}
fs.writeFileSync(OUT + '/INVENTORY-MANIFEST.json', JSON.stringify({ note: 'Conformed 1080p24 copies of the recent Higgsfield videos + V74 lip-sync videos. Sources untouched.', builtAt: new Date().toISOString(), clips: manifest }, null, 2));
fs.writeFileSync(EDITOR + '/inventory.json', JSON.stringify({ clips: manifest.filter(m => !m.failed).map(m => ({ id: m.id, file: m.file, title: m.title, frames: m.frames, group: m.group, model: m.model, at: m.at })) }, null, 1));
fs.mkdirSync('projects/garage-dream', { recursive: true }); fs.copyFileSync(OUT + '/INVENTORY-MANIFEST.json', 'projects/garage-dream/INVENTORY-MANIFEST.json');
console.log('inventory:', manifest.filter(m => !m.failed).length, 'clips,', manifest.filter(m => m.failed).length, 'failed');
