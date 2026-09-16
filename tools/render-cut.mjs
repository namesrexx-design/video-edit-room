// Render a Cut Room save (cuts/*.json, format 2: main video + 2nd video lane + added sound) to MP4.
//   node tools/render-cut.mjs <cut.json> <name>      -> projects/garage-dream/renders/<name>.mp4 (+ receipt, + V1-only .otio for Resolve)
// Main video = sequential clips (frame-exact). 2nd video = full-frame cutaways at absolute frames.
// Sound = the main clips' own sound, plus added sound blocks mixed in at their frames. Never overwrites.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync, execFileSync } from 'node:child_process';
import { buildTimeline, buildEdl, RATE } from './otio.mjs';
import { MEDIA_ROOT } from './paths.mjs';

const [, , cutPath, nameArg] = process.argv;
if (!cutPath || !nameArg) { console.error('usage: node tools/render-cut.mjs <cut.json> <name>'); process.exit(2); }
const MEDIA = MEDIA_ROOT;
const FOLDERS = { 'capcut-kit-v74/SCENES_IN_ORDER': `${MEDIA}/garage-through-apu-review/capcut-kit-v74/SCENES_IN_ORDER`, 'inventory-v74': `${MEDIA}/inventory-v74`, 'audio-bin-v74': `${MEDIA}/audio-bin-v74`, 'storyboard-final-20260915': `${MEDIA}/storyboard-final-20260915`, 'final-pass-20260916': `${MEDIA}/final-pass-20260916` };
const cut = JSON.parse(fs.readFileSync(cutPath, 'utf8'));
if (cut.format !== 2) throw new Error('expected a format-2 Cut Room save');
const proj = path.resolve('projects/garage-dream'); const renders = path.join(proj, 'renders');
const OUT = path.join(renders, nameArg + '.mp4'); if (fs.existsSync(OUT)) throw new Error('output exists, will not overwrite: ' + OUT);
fs.mkdirSync(path.join(renders, 'RECEIPTS'), { recursive: true }); fs.mkdirSync(path.join(proj, 'timelines'), { recursive: true });

const run = a => { const r = spawnSync('ffmpeg', ['-v', 'error', '-nostdin', '-n', ...a], { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64e6 }); if (r.status !== 0) throw new Error('ffmpeg failed\n' + r.stderr.toString().slice(-1500)); };
const probe = (p, count = false) => JSON.parse(execFileSync('ffprobe', ['-v', 'error', ...(count ? ['-count_frames'] : []), '-show_streams', '-show_format', '-of', 'json', p], { encoding: 'utf8', maxBuffer: 64e6 }));
const nframes = p => +probe(p, true).streams.find(s => s.codec_type === 'video').nb_read_frames;
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').toUpperCase();
const file = b => { const d = FOLDERS[b.folder]; if (!d) throw new Error('unknown folder ' + b.folder); const p = `${d}/${b.file}`; if (!fs.existsSync(p)) throw new Error('missing media ' + p); return p; };
const dur = b => b.end - b.start;

const TOTAL = cut.v1.reduce((s, b) => s + dur(b), 0); if (!TOTAL) throw new Error('main video is empty');
const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'cutroom-'));
console.log(`${nameArg}: main ${cut.v1.length} clips / ${TOTAL} f (${(TOTAL / RATE).toFixed(2)} s), 2nd video ${cut.v2.length}, added sound ${cut.a2.length}`);

// 1. main picture, frame-exact segments -> concat
const segs = [];
cut.v1.forEach((b, i) => { const dest = path.join(stage, `v${String(i).padStart(3, '0')}.mp4`); process.stdout.write(`  main ${String(i + 1).padStart(2)}/${cut.v1.length} ${b.file.slice(0, 50).padEnd(50)} ${String(dur(b)).padStart(4)}f `);
  run(['-ss', String(b.start / RATE), '-i', file(b), '-map', '0:v:0', '-an', '-t', String(dur(b) / RATE), '-vf', 'scale=1920:1080:flags=lanczos,setsar=1,format=yuv420p', '-r', String(RATE), '-fps_mode', 'cfr', '-frames:v', String(dur(b)), '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-video_track_timescale', '12288', dest]);
  const got = nframes(dest); if (got !== dur(b)) throw new Error(`segment ${i}: ${got} frames, need ${dur(b)}`); console.log('ok'); segs.push(dest); });
fs.writeFileSync(path.join(stage, 'concat.txt'), segs.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n') + '\n');
const base = path.join(stage, 'base.mp4'); run(['-f', 'concat', '-safe', '0', '-i', path.join(stage, 'concat.txt'), '-c', 'copy', base]);

// 2. 2nd video lane: cutaways overlaid at their frames (clipped to the main length)
let picture = base;
const overlays = cut.v2.filter(b => b.at < TOTAL).map((b, i) => { const n = Math.min(dur(b), TOTAL - b.at); const dest = path.join(stage, `o${i}.mp4`); process.stdout.write(`  2nd video ${b.file.slice(0, 50).padEnd(50)} @${b.at} ${n}f `);
  run(['-ss', String(b.start / RATE), '-i', file(b), '-map', '0:v:0', '-an', '-t', String(n / RATE), '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p', '-r', String(RATE), '-fps_mode', 'cfr', '-frames:v', String(n), '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-video_track_timescale', '12288', dest]); console.log('ok'); return { dest, at: b.at, n }; });
if (overlays.length) {
  /* -reinit_filter 0: a clip with different colour tags (S09 complete: bt709/tv vs untagged) made ffmpeg rebuild the graph mid-stream, resetting N and dropping 812 frames (V75, 2026-09-15). Frame-index pts (N/FRAME_RATE/TB) on both lanes. */
  const inputs = ['-reinit_filter', '0', '-i', base]; let g = '[0:v]setpts=N/FRAME_RATE/TB[b0]'; let cur = 'b0';
  overlays.forEach((o, i) => { inputs.push('-i', o.dest); g += `;[${i + 1}:v]setpts=N/FRAME_RATE/TB+${(o.at / RATE).toFixed(6)}/TB[o${i}];[${cur}][o${i}]overlay=eof_action=pass:x=0:y=0[b${i + 1}]`; cur = `b${i + 1}`; });
  picture = path.join(stage, 'picture.mp4');
  run([...inputs, '-filter_complex', g, '-map', `[${cur}]`, '-frames:v', String(TOTAL), '-r', String(RATE), '-fps_mode', 'cfr', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p', '-video_track_timescale', '12288', picture]);
  const got = nframes(picture); if (got !== TOTAL) throw new Error(`picture with overlays has ${got} frames, need ${TOTAL}`);
}

// 3. sound: main clips' own sound in one continuous pass, then added sound blocks mixed in at their frames
const ain = []; const parts = []; let k = 0;
for (const b of cut.v1) { const p = file(b); const hasA = !b.mute && probe(p).streams.some(s => s.codec_type === 'audio');  // mute = the scene's sound was pulled out onto its own block
  if (hasA) { ain.push('-ss', String(b.start / RATE), '-t', String(dur(b) / RATE), '-i', p); parts.push(`[${k}:a]aresample=48000,aformat=channel_layouts=stereo,asetpts=PTS-STARTPTS[m${k}]`); }
  else { ain.push('-f', 'lavfi', '-t', String(dur(b) / RATE), '-i', 'anullsrc=r=48000:cl=stereo'); parts.push(`[${k}:a]asetpts=PTS-STARTPTS[m${k}]`); } k++; }
let g = parts.join(';') + ';' + parts.map((_, i) => `[m${i}]`).join('') + `concat=n=${k}:v=0:a=1[main]`; let mixIn = ['[main]']; let idx = k;
for (const b of cut.a2.filter(b => b.at < TOTAL)) { const n = Math.min(dur(b), TOTAL - b.at); ain.push('-ss', String(b.start / RATE), '-t', String(n / RATE), '-i', file(b)); const ms = Math.round(b.at / RATE * 1000); const gain = Number.isFinite(b.gain) && b.gain !== 0 ? `,volume=${b.gain}dB` : '';   // per-block level trim in dB (owner/QC leveling, 2026-09-15)
  g += `;[${idx}:a]aresample=48000,aformat=channel_layouts=stereo,asetpts=PTS-STARTPTS${gain},adelay=${ms}|${ms}[x${idx}]`; mixIn.push(`[x${idx}]`); idx++; }
if (mixIn.length > 1) g += `;${mixIn.join('')}amix=inputs=${mixIn.length}:normalize=0:dropout_transition=0[a]`; else g += ';[main]anull[a]';
const sound = path.join(stage, 'sound.wav'); run([...ain, '-filter_complex', g, '-map', '[a]', '-t', String(TOTAL / RATE), '-c:a', 'pcm_s16le', sound]);

// 4. mux + verify
const pending = OUT.replace(/\.mp4$/, '.unverified.mp4');
run(['-i', picture, '-i', sound, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-af', `atrim=end_sample=${Math.round(TOTAL / RATE * 48000)},asetpts=PTS-STARTPTS`, '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', pending]);
const got = nframes(pending); if (got !== TOTAL) throw new Error(`final has ${got} frames, need ${TOTAL}`);
run(['-xerror', '-i', pending, '-f', 'null', '-']);
const scan = spawnSync('ffmpeg', ['-v', 'info', '-nostdin', '-i', pending, '-an', '-vf', 'blackdetect=d=0.041:pix_th=0.10', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 64e6 });
const black = (scan.stderr.match(/black_start:[^\n]*/g) || []);
fs.renameSync(pending, OUT);

// 5. V1-only timeline for Resolve + receipt
const clips = cut.v1.map(b => ({ name: b.file.replace(/\.mp4$/, ''), file: file(b), start: b.start, duration: dur(b) }));
fs.writeFileSync(path.join(proj, 'timelines', nameArg + '.otio'), JSON.stringify(buildTimeline(nameArg, clips, { from: path.basename(cutPath), note: '2nd video lane and added sound are in the cut JSON + render receipt, not in this V1-only timeline' }), null, 2));
fs.writeFileSync(path.join(proj, 'timelines', nameArg + '.edl'), buildEdl(nameArg, clips));
const receipt = { cut: path.basename(cutPath), cutSha256: sha(cutPath), savedAt: cut.savedAt, output: OUT, outputSha256: sha(OUT), bytes: fs.statSync(OUT).size, frames: TOTAL, seconds: +(TOTAL / RATE).toFixed(6), renderedAt: new Date().toISOString(), blackIntervals: black, v1: cut.v1, v2: cut.v2, a2: cut.a2 };
fs.writeFileSync(path.join(renders, 'RECEIPTS', nameArg + '.mp4.receipt.json'), JSON.stringify(receipt, null, 2));
fs.rmSync(stage, { recursive: true, force: true });
console.log(`rendered ${nameArg}.mp4  ${TOTAL} frames  ${(receipt.bytes / 1e6).toFixed(1)} MB  black: ${black.length}  sha ${receipt.outputSha256.slice(0, 8)}`);
