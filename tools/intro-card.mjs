#!/usr/bin/env node
// intro-card.mjs — the true-crime style opening card for client-story videos (Rexx, 2026-09-16):
// "make it sound like the old murder mystery stuff… the following clips contain renditions of what happened
//  and we've changed the names of the characters to save their privacy… then we go into the video."
//
// Client stories are never introduced by name in public; real client interviews live only in the pitch deck.
// Do NOT put this card on Rexx's own story (his real name is used there, so "names have been changed" is false).
//
//   node tools/intro-card.mjs --out card.mp4 [--size 1920x1080|1080x1920] [--lines "a|b|c"] [--theme lyfe|noir] [--silent] [--seconds 7]
//
// Picture (--theme noir): black film ground with grain and a vignette, typewriter face (Special Elite, Apache-2.0, tools/fonts),
// each line fades in on its own beat. Sound: a quiet low drone made here (no music, nothing to be claimed).
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FONTS = join(HERE, 'fonts');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => {
  if (v.startsWith('--')) a.push([v.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
  return a;
}, []));

const DEFAULT_LINES = [
  'The following story is based on real events.',
  'Some scenes are dramatized.',
  'Names and identities have been changed to protect the privacy of those involved.',
];
const out = args.out ? resolve(String(args.out)) : null;
if (!out) { console.error('usage: node tools/intro-card.mjs --out card.mp4 [--size 1920x1080|1080x1920] [--lines "a|b|c"] [--silent]'); process.exit(2); }
const [W, H] = String(args.size || '1920x1080').split('x').map(Number);
const lines = args.lines ? String(args.lines).split('|').map((s) => s.trim()).filter(Boolean) : DEFAULT_LINES;
const SECONDS = Number(args.seconds || 7);
const vertical = H > W;
// --theme lyfe (default, Rexx 2026-09-16: "use our logo background so it blends into everything else we do"):
//   deep teal #073B42 (the page-edge color), cream lettering #FFF9ED, the LYFE cloud fading in above the words.
// --theme noir: the first version, black film ground, no logo.
const THEME = String(args.theme || 'lyfe');
const LYFE = THEME === 'lyfe';
const BG = LYFE ? '0x073B42' : '0x0b0b0c';
const TEXT = LYFE ? '&H00EDF9FF' : '&H00E6EBEE';     // ASS colors are &HAABBGGRR
const LOGO = join(HERE, 'brand', 'lyfe-cloud.png');
const logoH = LYFE ? Math.round(vertical ? W * 0.36 : H * 0.22) : 0;
const logoGap = LYFE ? Math.round(logoH * 0.18) : 0;

// layout: lines stacked around the middle; vertical frames wrap long lines
const size = Math.round((vertical ? W : H) * (vertical ? 0.058 : 0.052));
const gap = Math.round(size * (vertical ? 2.1 : 1.9));
const wrapAt = vertical ? 22 : 44;
const wrap = (s) => {
  const words = s.split(' '); const rows = []; let row = '';
  for (const w of words) { if ((row + ' ' + w).trim().length > wrapAt && row) { rows.push(row); row = w; } else row = (row + ' ' + w).trim(); }
  if (row) rows.push(row);
  return rows.join('\\N');
};
const rowsPer = lines.map((l) => wrap(l).split('\\N').length);
const blockH = rowsPer.reduce((a, n) => a + n * size * 1.25, 0) + gap * (lines.length - 1) * 0.5;
const logoTop = Math.round(H / 2 - (blockH + logoH + logoGap) / 2);
let y = LYFE ? logoTop + logoH + logoGap : H / 2 - blockH / 2;
const t = (s) => { const cs = Math.round(s * 100); const h = Math.floor(cs / 360000), m = Math.floor(cs / 6000) % 60, sec = Math.floor(cs / 100) % 60, c = cs % 100; return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(c).padStart(2, '0')}`; };
const beat = (SECONDS - 2.4) / Math.max(1, lines.length);
const events = lines.map((l, i) => {
  const start = 0.5 + i * beat;
  const top = Math.round(y); y += rowsPer[i] * size * 1.25 + gap * 0.5;
  return `Dialogue: 0,${t(start)},${t(SECONDS - 0.2)},Card,,0,0,0,,{\\an8\\pos(${Math.round(W / 2)},${top})\\fad(700,900)}${wrap(l)}`;
});
const ass = `[Script Info]
ScriptType: v4.00+
PlayResX: ${W}
PlayResY: ${H}
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Card,Special Elite,${size},${TEXT},${TEXT},&H00000000,&H64000000,0,0,0,0,100,100,1,0,1,0,2,8,40,40,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events.join('\n')}
`;
const dir = mkdtempSync(join(tmpdir(), 'introcard-'));
const assPath = join(dir, 'card.ass');
writeFileSync(assPath, ass);
// ffmpeg filter paths: forward slashes, escape the drive colon
const esc = (p) => p.replace(/\\/g, '/').replace(/:/g, '\\:');

const ground = `color=c=${BG}:s=${W}x${H}:r=24:d=${SECONDS},format=rgb24,noise=alls=${LYFE ? 6 : 10}:allf=t,vignette=PI/${LYFE ? 9 : 4}`;
const finish = `ass='${esc(assPath)}':fontsdir='${esc(FONTS)}',fade=t=in:st=0:d=0.4,fade=t=out:st=${SECONDS - 0.5}:d=0.5,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p[v]`;
// tag the file as BT.709 so phones show the brand teal as teal, not green
const video = LYFE
  ? `${ground}[g];movie='${esc(LOGO)}',scale=-1:${logoH},format=rgba,loop=loop=-1:size=1,trim=duration=${SECONDS},setpts=N/24/TB,fade=t=in:st=0.2:d=1.2:alpha=1[l];[g][l]overlay=x=(W-w)/2:y=${logoTop}:shortest=1,${finish}`
  : `${ground},${finish}`;
const drone = `sine=f=55:d=${SECONDS}[a1];sine=f=110:d=${SECONDS}[a2];sine=f=164.8:d=${SECONDS},volume=0.5[a3];[a1][a2][a3]amix=inputs=3,volume=2.2,lowpass=f=600,afade=t=in:d=1.2,afade=t=out:st=${SECONDS - 1.4}:d=1.4,aformat=sample_rates=48000:channel_layouts=stereo[a]`;
const silence = `anullsrc=r=48000:cl=stereo,atrim=0:${SECONDS}[a]`;
const r = spawnSync('ffmpeg', ['-y', '-v', 'error', '-filter_complex', `${video};${args.silent ? silence : drone}`,
  '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
  '-c:a', 'aac', '-b:a', '192k', '-t', String(SECONDS), '-movflags', '+faststart', out], { stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status || 1);
console.log(`intro card → ${out} (${W}x${H}, ${SECONDS}s, ${lines.length} lines${args.silent ? ', silent' : ''})`);
