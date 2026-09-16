// crawl-captions.mjs — the LYFE "crawl": text rises slowly on a tilted plane (Star Wars style) and each word
// lights up as it is spoken. Built for the daily Signs & Numbers readings (Aquarius stories). 2026-09-16
//
//   node tools/crawl-captions.mjs --script story.txt --audio vo.mp3 --words words.json --out out.mp4
//        [--bg background.mp4|png] [--title "AQUARIUS · TODAY"] [--sub "Signs & Numbers"] [--fps 30]
//
// The WORDS on screen come from --script (what he wrote). --words (from word-times.mjs, local Whisper) only
// times them: the script is aligned to the heard words, gaps are filled in proportion to length.
// Look: 1080x1920; unread words soft white, read words fill gold left to right; lines tilt away and fade at the top.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > -1 ? process.argv[i + 1] : d; };
const SCRIPT = arg('script'), AUDIO = arg('audio'), WORDS = arg('words'), OUT = arg('out'), BG = arg('bg');
const TITLE = arg('title', ''), SUB = arg('sub', ''), FPS = +arg('fps', 30);
if (!SCRIPT || !AUDIO || !WORDS || !OUT) { console.error('usage: --script --audio --words --out [--bg --title --sub]'); process.exit(1); }
if (fs.existsSync(OUT)) { console.error('output exists, will not overwrite: ' + OUT); process.exit(1); }

const W = 1080, H = 1920;
const FONT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fonts');
const FONT = 'Source Sans 3';
const SIZE = 96, LINE_H = 124, MAX_CHARS = 24;
const TOP = +(process.env.CRAWL_TOP ?? 0.34);   // width of the far (top) edge as a share of the near edge: the Star Wars lean
const SCREEN_READ = +(process.env.CRAWL_READ ?? 1250);   // on screen, the line being spoken sits at eye level
// the lean is a projective warp of the flat text layer (ffmpeg perspective); this is the same map, to place the read line
const Q = [[W * (1 - TOP) / 2, 0], [W * (1 + TOP) / 2, 0], [W, H], [0, H]];   // TL, TR, BR, BL
const HOM = (() => { const [q0, q1, q2, q3] = Q; const sx = q0[0] - q1[0] + q2[0] - q3[0], sy = q0[1] - q1[1] + q2[1] - q3[1];
  const dx1 = q1[0] - q2[0], dx2 = q3[0] - q2[0], dy1 = q1[1] - q2[1], dy2 = q3[1] - q2[1]; const den = dx1 * dy2 - dx2 * dy1;
  const g = (sx * dy2 - dx2 * sy) / den, h = (dx1 * sy - sx * dy1) / den;
  return { a: q1[0] - q0[0] + g * q1[0], b: q3[0] - q0[0] + h * q3[0], c: q0[0], d: q1[1] - q0[1] + g * q1[1], e: q3[1] - q0[1] + h * q3[1], f: q0[1], g, h }; })();
const screenY = (yFlat) => { const u = 0.5, v = yFlat / H; return (HOM.d * u + HOM.e * v + HOM.f) / (HOM.g * u + HOM.h * v + 1); };
let lo = 0, hi = H; for (let k = 0; k < 60; k++) { const mid = (lo + hi) / 2; if (screenY(mid) < SCREEN_READ) lo = mid; else hi = mid; }
const READ_Y = (lo + hi) / 2;   // flat y that lands on SCREEN_READ after the warp
const GOLD = '&H004CA2D4&', DIM = '&H40F4F1EA&', EDGE = '&H80000000&';   // ASS colours are &HAABBGGRR

const probe = (f) => +spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).stdout.trim();
const DUR = probe(AUDIO) + 1.5;

// ---- 1. script words, timed by the heard words
const script = fs.readFileSync(SCRIPT, 'utf8').replace(/\s+/g, ' ').trim().split(' ');
const heard = JSON.parse(fs.readFileSync(WORDS, 'utf8'));
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9']/g, '');
const a = script.map(norm), b = heard.map((w) => norm(w.text));
// Needleman-Wunsch alignment (match 2, mismatch -1, gap -1)
const n = a.length, m = b.length; const S = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
for (let i = 1; i <= n; i++) S[i][0] = -i; for (let j = 1; j <= m; j++) S[0][j] = -j;
for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) S[i][j] = Math.max(S[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 2 : -1), S[i - 1][j] - 1, S[i][j - 1] - 1);
const t0 = new Array(n).fill(null), t1 = new Array(n).fill(null);
for (let i = n, j = m; i > 0 && j > 0;) {
  if (S[i][j] === S[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 2 : -1)) { if (a[i - 1] === b[j - 1] || a[i - 1].length > 0) { t0[i - 1] = heard[j - 1].start; t1[i - 1] = heard[j - 1].end; } i--; j--; }
  else if (S[i][j] === S[i - 1][j] - 1) i--; else j--;
}
// fill words the aligner could not place, in proportion to their length between known neighbours
for (let i = 0; i < n; i++) {
  if (t0[i] != null) continue;
  let k = i; while (k < n && t0[k] == null) k++;
  const from = i > 0 ? t1[i - 1] : 0, to = k < n ? t0[k] : (heard.at(-1)?.end ?? DUR - 1.5);
  const lens = script.slice(i, k).map((w) => w.length + 1); const tot = lens.reduce((x, y) => x + y, 0);
  let t = from; for (let q = i; q < k; q++) { const d = (to - from) * lens[q - i] / tot; t0[q] = t; t1[q] = t + d; t += d; }
  i = k - 1;
}
const matched = t0.filter((x, i) => heard.length && x != null).length;

// ---- 2. lines
const lines = []; let cur = [];
for (let i = 0; i < n; i++) {
  const len = cur.reduce((x, k) => x + script[k].length + 1, 0);
  if (cur.length && len + script[i].length > MAX_CHARS) { lines.push(cur); cur = []; }
  cur.push(i);
  if (/[.!?]$/.test(script[i]) && cur.reduce((x, k) => x + script[k].length + 1, 0) > MAX_CHARS * 0.55) { lines.push(cur); cur = []; }
}
if (cur.length) lines.push(cur);

// ---- 3. crawl speed: line i reaches READ_Y when its first word is spoken (least-squares straight line)
const xs = lines.map((L) => t0[L[0]]), ys = lines.map((_, i) => i * LINE_H);
const mx = xs.reduce((x, y) => x + y, 0) / xs.length, my = ys.reduce((x, y) => x + y, 0) / ys.length;
let v = xs.length > 1 ? xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / xs.reduce((s, x) => s + (x - mx) ** 2, 0) : 60;
if (!(v > 10)) v = 60;
const c = my - v * mx; const Y0 = READ_Y - c;   // y_i(t) = Y0 + i*LINE_H - v*t

// ---- 4. ASS
const cs = (s) => Math.max(0, Math.round(s * 100));
const ts = (s) => { const h = Math.floor(s / 3600), mi = Math.floor(s / 60) % 60, se = (s % 60).toFixed(2).padStart(5, '0'); return `${h}:${String(mi).padStart(2, '0')}:${se}`; };
const esc = (s) => s.replace(/[{}\\]/g, '');
let ass = `[Script Info]
ScriptType: v4.00+
PlayResX: ${W}
PlayResY: ${H}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Crawl,${FONT},${SIZE},${GOLD},${DIM},${EDGE},&H00000000&,-1,0,0,0,100,100,1,0,1,3,0,5,60,60,0,1
Style: Title,${FONT},64,&H00F4F1EA&,&H00F4F1EA&,${EDGE},&H00000000&,-1,0,0,0,100,100,6,0,1,3,0,8,60,60,150,1
Style: Sub,${FONT},38,${GOLD},${GOLD},${EDGE},&H00000000&,0,0,0,0,100,100,4,0,1,2,0,8,60,60,236,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
lines.forEach((L, i) => {
  const yA = Y0 + i * LINE_H, yB = Y0 + i * LINE_H - v * DUR;
  if (yB > H + 200 || yA < -400) return;
  let k = `{\\an5\\move(${W / 2},${yA.toFixed(1)},${W / 2},${yB.toFixed(1)})}`;
  let at = 0;
  L.forEach((wi, q) => {
    const start = t0[wi], end = q < L.length - 1 ? t0[L[q + 1]] : t1[wi];
    if (start > at) { k += `{\\k${cs(start - at)}}`; at = start; }
    k += `{\\kf${Math.max(1, cs(end - start))}}${esc(script[wi])}${q < L.length - 1 ? ' ' : ''}`;
    at = end;
  });
  ass += `Dialogue: 0,${ts(0)},${ts(DUR)},Crawl,,0,0,0,,${k}\n`;
});
let top = ass.split('[Events]')[0] + '[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n';
if (TITLE) top += `Dialogue: 1,${ts(0)},${ts(DUR)},Title,,0,0,0,,{\\fad(400,400)}${esc(TITLE)}\n`;
if (SUB) top += `Dialogue: 1,${ts(0)},${ts(DUR)},Sub,,0,0,0,,{\\fad(400,400)}${esc(SUB)}\n`;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'crawl-'));
const assFile = path.join(tmp, 'crawl.ass'); fs.writeFileSync(assFile, ass);
const topFile = path.join(tmp, 'top.ass'); fs.writeFileSync(topFile, top);

// ---- 5. picture: background (or a slow starfield) + top/bottom fade + the crawl, then the voice
const bgIn = BG
  ? (/\.(png|jpe?g|webp)$/i.test(BG) ? ['-loop', '1', '-t', String(DUR), '-i', BG] : ['-stream_loop', '-1', '-t', String(DUR), '-i', BG])
  : ['-f', 'lavfi', '-t', String(DUR), '-i', `color=c=0x07060a:s=${W}x${H}:r=${FPS}`];
const stars = BG ? '' : `,geq=lum='if(lt(random(1)\\,0.0009)\\,255\\,lum(X\\,Y))':cb=128:cr=128,boxblur=1:1`;
const fade = `color=c=black:s=${W}x${H}:r=${FPS}:d=${DUR},format=rgba,geq=r=0:g=0:b=0:a='255*min(1\\,max(max(0\\,1-(Y-300)/560)\\,max(0\\,(Y-1600)/320)))'`;
const esca = (p) => p.replace(/\\/g, '/').replace(/:/g, '\\:');
const fc = `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${FPS},format=yuv420p${stars}${BG ? ',eq=brightness=-0.12:saturation=0.85' : ''}[bg];color=c=black@0.0:s=${W}x${H}:r=${FPS}:d=${DUR},format=rgba,ass='${esca(assFile)}':fontsdir='${esca(FONT_DIR)}':alpha=1,format=yuva444p,perspective=x0=${Q[0][0]}:y0=${Q[0][1]}:x1=${Q[1][0]}:y1=${Q[1][1]}:x2=${Q[3][0]}:y2=${Q[3][1]}:x3=${Q[2][0]}:y3=${Q[2][1]}:sense=destination:interpolation=cubic[warp];${fade}[fd];[bg][warp]overlay=shortest=1:format=auto[b1];[b1][fd]overlay=shortest=1[b2];[b2]ass='${esca(topFile)}':fontsdir='${esca(FONT_DIR)}'[v]`;
const r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...bgIn, '-i', AUDIO, '-filter_complex', fc, '-map', '[v]', '-map', '1:a', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-t', String(DUR), '-movflags', '+faststart', OUT], { stdio: ['ignore', 'inherit', 'inherit'] });
if (r.status !== 0) { console.error('render failed (status ' + r.status + ', signal ' + r.signal + (r.error ? ', ' + r.error.message : '') + '); subtitle file kept at ' + assFile); process.exit(1); }
console.log(JSON.stringify({ out: OUT, seconds: +DUR.toFixed(2), words: n, lines: lines.length, aligned_from_whisper: matched, speed_px_per_s: +v.toFixed(1), read_line_flat: Math.round(READ_Y), top_width: TOP }));
