// slice-scenes.mjs — cut a rendered film back into one clip per scene, exactly as it plays.
//   node tools/slice-scenes.mjs <cut.json> <film.mp4> <outDir>
// Each main-lane block carries a `scene` (S08…); blocks without one use their id when it looks like a scene id.
// Neighbouring blocks of the same scene are joined.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const [, , cutPath, film, outDir] = process.argv;
if (!cutPath || !film || !outDir) { console.error('usage: node tools/slice-scenes.mjs <cut.json> <film.mp4> <outDir>'); process.exit(2); }
const cut = JSON.parse(fs.readFileSync(cutPath, 'utf8'));
const RATE = cut.fps || 24;
const rows = []; let t = 0;
for (const b of cut.v1) {
  const n = b.end - b.start; const id = b.scene || (/^S\d+[A-Z]?$/.test(b.id) ? b.id : null);
  const last = rows[rows.length - 1];
  if (id && last && last.id === id) last.n += n; else if (id) rows.push({ id, t, n }); else if (last) last.n += n;
  t += n;
}
fs.mkdirSync(outDir, { recursive: true });
for (const r of rows) {
  const out = path.join(outDir, r.id + '.mp4');
  const p = spawnSync('ffmpeg', ['-y', '-v', 'error', '-ss', String(r.t / RATE), '-i', film, '-frames:v', String(r.n), '-t', String(r.n / RATE), '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out], { stdio: 'inherit' });
  console.log(`${r.id} ${r.n}f ${p.status === 0 ? 'ok' : 'FAILED'}`);
}
