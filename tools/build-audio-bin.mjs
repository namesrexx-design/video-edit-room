// Build the Garage Dream AUDIO BIN: music, approved voice takes, cues and the V74 stems, as
// 48 kHz stereo WAV for rendering + small MP3 proxies and audio.json for the Cut Room page.
//   node tools/build-audio-bin.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync, execFileSync } from 'node:child_process';

const CODEX = 'C:/Users/16263/Documents/Codex/2026-09-04/referenced-chatgpt-conversation-this-is-an-2';
const OUT = 'D:/REXX/AI_Video/BizBox-Garage-Dream/audio-bin-v74';
const EDITOR = 'C:/Users/16263/AppData/Local/Temp/claude/C--Users-16263-Desktop-Claude-Code-Build/9d00f0c5-975e-4197-b36d-8f1eb6052b13/scratchpad/film/editor';
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(EDITOR + '/audio', { recursive: true });

const run = a => { const r = spawnSync('ffmpeg', ['-v', 'error', '-nostdin', '-n', ...a], { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64e6 }); if (r.status !== 0) throw new Error('ffmpeg\n' + r.stderr.toString().slice(-800)); };
const dur = p => +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p], { encoding: 'utf8' });
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').toUpperCase();
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);

const S = [];
const add = (group, title, src) => { if (fs.existsSync(src)) S.push({ group, title, src }); else console.warn('missing', src); };
// music
add('music', 'BizBox piano theme — Pursuit of Happiness', 'G:/My Drive/00_INTAKE/bizbox/Pursuit of Happiness $5.mp3');
add('music', 'Kid Cudi — 1', 'G:/My Drive/00_INTAKE/namesrexx/Kid Cudi - 1.mp3');
add('music', 'Kid Cudi — 2', 'G:/My Drive/00_INTAKE/namesrexx/Kid Cudi - 2.mp3');
add('music', 'Bugatti song phrase (6.5 s reference)', CODEX + '/worker-audio-v73/V73-BUGATTI-SONG-PHRASE-REFERENCE-6P5S-48K.wav');
add('music', 'Song + whisper, car audition (54.5–67 s)', CODEX + '/worker-audio-v73/V73-SONG-WHISPER-CAR-AUDITION-54P5-67P0.wav');
// voice takes
for (const f of fs.readdirSync(CODEX + '/worker-lipsync-v74').filter(x => x.endsWith('.wav') && !/HANDLES/.test(x)).sort()) add('voice', f.replace(/\.wav$/, '').replace(/-/g, ' '), `${CODEX}/worker-lipsync-v74/${f}`);
add('voice', 'Bart — door V3 (3 s, approved voice)', CODEX + '/worker-audio-v73/BART-DOOR-V3-THREE-SECONDS-APPROVED-VOICE.wav');
add('voice', 'Bart — complete take (5 s)', CODEX + '/worker-audio-v73/V73-BART-COMPLETE-TAKE-48K.wav');
add('voice', 'Bart — Eat my shorts (2.5 s)', CODEX + '/worker-audio-v73/V73-BART-COMPLETE-EAT-MY-SHORTS-0P20-2P65-48K.wav');
add('voice', 'Bart — exit V4 phone free (5 s)', CODEX + '/worker-audio-v73/BART-EXIT-V4-PHONE-FREE.wav');
add('voice', 'Homer — Bugatti three whispers', CODEX + '/worker-audio-v73/HOMER-BUGATTI-THREE-WHISPERS-V2-48K.wav');
add('voice', 'Bugatti intro replacement (56.7–63.1 s)', CODEX + '/worker-audio-v73/V73-BUGATTI-INTRO-REPLACEMENT-56P691667-63P083333-48K.wav');
add('voice', 'Rexx — Waymo arrival line', CODEX + '/worker-audio-v73/V73-WAYMO-ARRIVAL-LINE-JCUT-26P700-48K.wav');
add('voice', 'Rexx — No! It was that kid (S21)', CODEX + '/scene-board/S21.mp3');
// cues
add('cue', 'Snore cue — mosquito', CODEX + '/worker-audio-v70/V71-SNORE-MOSQUITO-CUE.wav');
add('cue', 'Snore cue — recliner', CODEX + '/worker-audio-v70/V71-SNORE-RECLINER-CUE.wav');
// V74 stems (full 115 s timeline, start at 0)
add('stem', 'V74 stem — mosquito buzz', CODEX + '/worker-audio-v74/V74-MOSQUITO-BUZZ-62P083333-115P166667-48K-F32.wav');
add('stem', 'V74 stem — snore', CODEX + '/worker-audio-v74/V74-MOSQUITO-SNORE-62P083333-115P166667-48K-F32.wav');
add('stem', 'V74 stem — Bart line', CODEX + '/worker-audio-v74/V74-BART-COMPLETE-REPLACEMENT-115P166667-48K-F32.wav');
add('stem', 'V74 stem — Waymo/driveway bridge', CODEX + '/worker-audio-v74/V74-WAYMO-DRIVEWAY-BRIDGE-115P166667-48K-F32.wav');
add('stem', 'V74 full mix (what is in the cut now)', CODEX + '/worker-audio-v74/GARAGE-DREAM-V74-AUDIO-FIXES-115P166667-48K-F32.wav');

const manifest = []; let i = 0;
for (const s of S) {
  i++; const id = 'AUD' + String(i).padStart(3, '0'); const name = `${id}_${slug(path.basename(s.src).replace(/\.[^.]+$/, ''))}.wav`; const dest = `${OUT}/${name}`;
  process.stdout.write(`${id} ${s.group.padEnd(6)} ${s.title.slice(0, 56).padEnd(56)} `);
  try {
    if (!fs.existsSync(dest)) run(['-i', s.src, '-vn', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', dest]);
    if (!fs.existsSync(`${EDITOR}/audio/${id}.mp3`)) run(['-i', dest, '-c:a', 'libmp3lame', '-b:a', '96k', `${EDITOR}/audio/${id}.mp3`]);
    const d = dur(dest); const frames = Math.round(d * 24);
    manifest.push({ id, file: name, local: dest, source: s.src, sha256: sha(dest), seconds: +d.toFixed(3), frames, group: s.group, title: s.title });
    console.log('ok', d.toFixed(1), 's');
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); }
}
fs.writeFileSync(OUT + '/AUDIO-MANIFEST.json', JSON.stringify({ note: '48 kHz stereo WAV copies for rendering. Sources untouched.', builtAt: new Date().toISOString(), clips: manifest }, null, 2));
fs.writeFileSync(EDITOR + '/audio.json', JSON.stringify({ clips: manifest.map(m => ({ id: m.id, file: m.file, title: m.title, frames: m.frames, group: m.group })) }, null, 1));
fs.copyFileSync(OUT + '/AUDIO-MANIFEST.json', 'projects/garage-dream/AUDIO-MANIFEST.json');
console.log('audio bin:', manifest.length, 'clips');
