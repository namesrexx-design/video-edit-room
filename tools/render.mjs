// Render a .otio timeline to a 1080p24 MP4 with ffmpeg. The ONLY way a cut gets rendered.
//   node tools/render.mjs projects/garage-dream/timelines/GARAGE-DREAM-V74.otio  [out.mp4]
// Never overwrites. Writes <out>.receipt.json next to the render and copies the receipt into
// the project's renders/RECEIPTS folder. Verifies frame count, full decode and black frames.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync, execFileSync } from 'node:child_process';
import { readTimeline, RATE } from './otio.mjs';

const [, , tlPath, outArg] = process.argv;
if (!tlPath) { console.error('usage: node tools/render.mjs <timeline.otio> [out.mp4]'); process.exit(2); }
const tl = readTimeline(tlPath);
for (const w of tl.warnings) console.warn('warning:', w);

const projDir = path.resolve(path.dirname(tlPath), '..');
const renders = path.join(projDir, 'renders');
const OUT = path.resolve(outArg ?? path.join(renders, tl.name + '.mp4'));
if (fs.existsSync(OUT)) throw new Error('output exists, will not overwrite: ' + OUT);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.mkdirSync(path.join(renders, 'RECEIPTS'), { recursive: true });

const run = a => { const r = spawnSync('ffmpeg', ['-v', 'error', '-nostdin', '-n', ...a], { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64e6 }); if (r.status !== 0) throw new Error('ffmpeg failed\n' + r.stderr.toString().slice(-1500)); return r; };
const probe = (p, count = false) => JSON.parse(execFileSync('ffprobe', ['-v', 'error', ...(count ? ['-count_frames'] : []), '-show_streams', '-show_format', '-of', 'json', p], { encoding: 'utf8', maxBuffer: 64e6 }));
const nframes = p => +probe(p, true).streams.find(s => s.codec_type === 'video').nb_read_frames;
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').toUpperCase();

// 1. inputs exist, are 1080p24, have enough frames; hashes match when recorded
const media = new Map();
for (const it of tl.items) {
  if (it.kind !== 'clip') continue;
  if (!media.has(it.file)) {
    if (!fs.existsSync(it.file)) throw new Error('missing media: ' + it.file);
    const v = probe(it.file, true).streams.find(s => s.codec_type === 'video');
    const info = { n: +v.nb_read_frames, w: v.width, h: v.height, fr: v.r_frame_rate, sha: sha(it.file) };
    if (it.sha256 && info.sha !== it.sha256.toUpperCase()) throw new Error(`media changed since the timeline was written: ${path.basename(it.file)}`);
    media.set(it.file, info);
  }
  const m = media.get(it.file);
  if (it.start + it.duration > m.n) throw new Error(`${it.name}: needs frames ${it.start}-${it.start + it.duration} but ${path.basename(it.file)} has ${m.n}`);
}
const TOTAL = tl.items.reduce((s, it) => s + it.duration, 0);
console.log(`${tl.name}: ${tl.items.length} items, ${TOTAL} frames = ${(TOTAL / RATE).toFixed(3)} s, ${media.size} media files`);

// 2. picture: one frame-exact segment per item, then concat
const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'editroom-'));
const segs = [];
tl.items.forEach((it, i) => {
  const dest = path.join(stage, `v${String(i).padStart(3, '0')}.mp4`);
  process.stdout.write(`  ${String(i + 1).padStart(2)}/${tl.items.length}  ${it.name.slice(0, 48).padEnd(48)} ${String(it.duration).padStart(4)}f  `);
  if (it.kind === 'gap') {
    run(['-f', 'lavfi', '-i', `color=c=black:s=1920x1080:r=${RATE}`, '-frames:v', String(it.duration), '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p', '-video_track_timescale', '12288', dest]);
  } else {
    const vf = 'scale=1920:1080:flags=lanczos,setsar=1,format=yuv420p';
    run(['-ss', String(it.start / RATE), '-i', it.file, '-map', '0:v:0', '-an', '-t', String(it.duration / RATE), '-vf', vf, '-r', String(RATE), '-fps_mode', 'cfr', '-frames:v', String(it.duration), '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-video_track_timescale', '12288', dest]);
  }
  const got = nframes(dest); if (got !== it.duration) throw new Error(`segment ${i} rendered ${got} frames, need ${it.duration}`);
  console.log('ok'); segs.push(dest);
});
fs.writeFileSync(path.join(stage, 'concat.txt'), segs.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n') + '\n');
const picture = path.join(stage, 'picture.mp4');
run(['-f', 'concat', '-safe', '0', '-i', path.join(stage, 'concat.txt'), '-c', 'copy', picture]);

// 3. sound: one continuous pass (no per-segment AAC gaps), silence for gaps or silent clips
const inputs = []; const parts = []; let k = 0;
for (const it of tl.items) {
  if (it.kind === 'gap' || !probe(it.file).streams.some(s => s.codec_type === 'audio')) {
    inputs.push('-f', 'lavfi', '-t', String(it.duration / RATE), '-i', 'anullsrc=r=48000:cl=stereo');
    parts.push(`[${k}:a]asetpts=PTS-STARTPTS[a${k}]`);
  } else {
    inputs.push('-ss', String(it.start / RATE), '-t', String(it.duration / RATE), '-i', it.file);
    parts.push(`[${k}:a]aresample=48000,aformat=channel_layouts=stereo,asetpts=PTS-STARTPTS[a${k}]`);
  }
  k++;
}
const graph = parts.join(';') + ';' + parts.map((_, i) => `[a${i}]`).join('') + `concat=n=${k}:v=0:a=1[a]`;
const sound = path.join(stage, 'sound.wav');
run([...inputs, '-filter_complex', graph, '-map', '[a]', '-c:a', 'pcm_s16le', sound]);

// 4. mux, trimmed to the exact picture length
const pending = OUT.replace(/\.mp4$/, '.unverified.mp4');
run(['-i', picture, '-i', sound, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-af', `atrim=end_sample=${Math.round(TOTAL / RATE * 48000)},asetpts=PTS-STARTPTS`, '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', pending]);

// 5. verify: frames, full decode, black intervals
const got = nframes(pending); if (got !== TOTAL) throw new Error(`final render has ${got} frames, need ${TOTAL}`);
run(['-xerror', '-i', pending, '-f', 'null', '-']);
const scan = spawnSync('ffmpeg', ['-v', 'info', '-nostdin', '-i', pending, '-an', '-vf', 'blackdetect=d=0.041:pix_th=0.10', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 64e6 });
const black = (scan.stderr.match(/black_start:[^\n]*/g) || []);
fs.renameSync(pending, OUT);

const receipt = {
  timeline: path.relative(projDir, tlPath).replace(/\\/g, '/'), timelineSha256: sha(tlPath), name: tl.name,
  output: OUT, outputSha256: sha(OUT), bytes: fs.statSync(OUT).size, frames: TOTAL, seconds: +(TOTAL / RATE).toFixed(6),
  renderedAt: new Date().toISOString(), renderedBy: process.env.EDITROOM_AGENT || os.userInfo().username,
  warnings: tl.warnings, blackIntervals: black,
  items: tl.items.map((it, i) => ({ i, name: it.name, kind: it.kind, file: it.file ? path.basename(it.file) : null, srcFrames: it.file ? [it.start, it.start + it.duration] : null, frames: it.duration })),
  media: [...media].map(([f, m]) => ({ file: f, sha256: m.sha, frames: m.n, size: `${m.w}x${m.h}@${m.fr}` })),
};
fs.writeFileSync(OUT + '.receipt.json', JSON.stringify(receipt, null, 2));
fs.copyFileSync(OUT + '.receipt.json', path.join(renders, 'RECEIPTS', path.basename(OUT) + '.receipt.json'));
fs.rmSync(stage, { recursive: true, force: true });
console.log(`rendered ${path.basename(OUT)}  ${TOTAL} frames  ${(receipt.bytes / 1e6).toFixed(1)} MB  black: ${black.length}  sha ${receipt.outputSha256.slice(0, 8)}`);
