// register-upload.mjs — file one uploaded media file into a scene (used by the studio server's Upload button).
//   node tools/register-upload.mjs <S##> <absolute file>
// video → conformed 1080p24 copy in inventory-v74 as the next INV id, thumbnail + web proxy, added to the scene
// image → added to the scene as a candidate still
// audio → 48 kHz copy in audio-bin-v74 as the next AUD id + web mp3, added to the scene
// Every entry is marked keep:true so the PC builders never drop it.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { MEDIA_ROOT, EDITOR_DIR } from './paths.mjs';

const [, , scene, file] = process.argv;
if (!/^S\d+[A-Z]?$/.test(scene || '') || !file || !fs.existsSync(file)) { console.error('usage: node tools/register-upload.mjs S27 /path/to/file'); process.exit(2); }
const SRC = 'projects/garage-dream/source/storyboard.json';
const sb = JSON.parse(fs.readFileSync(SRC, 'utf8')); const s = sb.scenes.find(x => x.id === scene);
if (!s) { console.error('no scene ' + scene); process.exit(2); }
const run = a => { const p = spawnSync('ffmpeg', ['-y', '-v', 'error', ...a], { stdio: 'inherit' }); if (p.status !== 0) throw new Error('ffmpeg failed'); };
const probe = (f, k) => spawnSync('ffprobe', ['-v', 'error', '-show_entries', k, '-of', 'csv=p=0', f], { encoding: 'utf8' }).stdout.trim();
const slug = path.basename(file).replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
const day = new Date().toISOString().slice(0, 10);
const nextId = (clips, prefix) => prefix + String(Math.max(0, ...clips.map(c => Number(String(c.id).replace(prefix, '')) || 0)) + 1).padStart(3, '0');
const add = (k, v) => { s[k] = Array.isArray(s[k]) ? s[k] : []; if (!s[k].includes(v)) s[k].push(v); };
const ext = path.extname(file).toLowerCase();

if (['.mp4', '.mov'].includes(ext)) {
  const mp = 'projects/garage-dream/INVENTORY-MANIFEST.json'; const m = JSON.parse(fs.readFileSync(mp, 'utf8'));
  const id = nextId(m.clips, 'INV'); const out = `${MEDIA_ROOT}/inventory-v74/${id}_${scene.toLowerCase()}-upload-${slug}.mp4`;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  run(['-i', file, '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p', '-r', '24', '-fps_mode', 'cfr', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-c:a', 'aac', '-ar', '48000', '-ac', '2', '-b:a', '256k', out]);
  const frames = Number(probe(out, 'stream=nb_frames')) || Math.round(Number(probe(out, 'format=duration')) * 24);
  fs.mkdirSync(`${EDITOR_DIR}/thumbs`, { recursive: true }); fs.mkdirSync(`${EDITOR_DIR}/clips`, { recursive: true });
  run(['-ss', '0.5', '-i', out, '-frames:v', '1', '-vf', 'scale=320:180', '-q:v', '4', `${EDITOR_DIR}/thumbs/${id}.jpg`]);
  run(['-i', out, '-vf', 'scale=1280:-2', '-c:v', 'libx264', '-preset', 'fast', '-crf', '25', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', `${EDITOR_DIR}/clips/${id}.mp4`]);
  m.clips.push({ id, file: path.basename(out), local: out, source: file, frames, seconds: frames / 24, group: 'owner', at: day, title: `${scene} owner upload ${slug}`, keep: true });
  fs.writeFileSync(mp, JSON.stringify(m, null, 1)); add('ownerAddedClips', id); add('approvedClipIds', id);
  console.log(`${scene}: video ${id} (${frames} f)`);
} else if (['.wav', '.mp3', '.m4a'].includes(ext)) {
  const ap = 'projects/garage-dream/AUDIO-MANIFEST.json'; const a = JSON.parse(fs.readFileSync(ap, 'utf8'));
  const id = nextId(a.clips.filter(c => /^AUD\d+$/.test(c.id)), 'AUD'); const out = `${MEDIA_ROOT}/audio-bin-v74/${id}_${scene.toLowerCase()}-upload-${slug}.wav`;
  fs.mkdirSync(path.dirname(out), { recursive: true }); fs.mkdirSync(`${EDITOR_DIR}/audio`, { recursive: true });
  run(['-i', file, '-ar', '48000', '-ac', '2', out]); run(['-i', out, '-c:a', 'libmp3lame', '-q:a', '3', `${EDITOR_DIR}/audio/${id}.mp3`]);
  const seconds = Math.round(Number(probe(out, 'format=duration')) * 100) / 100;
  a.clips.push({ id, file: path.basename(out), local: out, source: file, seconds, group: 'owner', date: day, title: `${scene} owner upload ${slug}`, keep: true });
  fs.writeFileSync(ap, JSON.stringify(a, null, 1)); add('ownerAddedAudio', id);
  console.log(`${scene}: audio ${id} (${seconds} s)`);
} else {
  const id = `UP-${scene}-${day.replace(/-/g, '')}-${slug}`.toUpperCase();
  s.pendingFrames = Array.isArray(s.pendingFrames) ? s.pendingFrames : [];
  s.pendingFrames.push({ id, image: file, title: `Owner upload · ${path.basename(file)}`, role: 'candidate', status: 'Uploaded on the studio page ' + day, renderEligible: false });
  console.log(`${scene}: still ${id}`);
}
fs.writeFileSync(SRC, JSON.stringify(sb, null, 2) + '\n');
