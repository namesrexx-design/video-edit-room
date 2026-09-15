// fill-drive-scene-folders.mjs — fill Codex's per-scene Drive folders with the real files.
//
//   node tools/fill-drive-scene-folders.mjs            (dry run: prints what would be copied)
//   node tools/fill-drive-scene-folders.mjs --write    (copies; never moves, never overwrites, never deletes)
//
// Codex laid out, on the Drive:
//   EDIT_ROOM/LYFE_STUDIO_BOARD/08_LYFE_STUDIO_SCENES__GARAGE_DREAM_EPISODE/
//     LIVE_SCENES/<SXX__TITLE>/{01_STILLS_AND_REFERENCES, 02_VIDEO, 03_AUDIO_AND_SFX, 04_SCRIPT_AND_DIALOGUE, 05_JSON_AND_RECEIPTS}
//     ARCHIVE_SCENES/<SXX__TITLE>/
// and could not move the files in. This does it from the same sources the LYFE board is built from:
//   stills  → tools/build-board.mjs's board-sources.json (every still behind every tile, with its real path)
//   video   → the V74 kit clips (capcut-kit-v74/SCENES_IN_ORDER), lip-sync + owner clips (inventory-v74), the
//             storyboard's own fullVideo per scene, and the S27 preview render
//   audio   → the storyboard's audioTracks per scene + audio-bin-v74 clips whose title names the scene
//   script  → SCRIPT.txt written from the board (line, cast, set, props, V74 timing, status)
//   json    → the scene's storyboard.json entry + its V74 cut blocks
// Current / cut / approved stills go to LIVE; pending and archived stills go to ARCHIVE_SCENES. Files keep their
// original names with a scene + role prefix, so nothing is renamed away from what it was.
import fs from 'node:fs';
import path from 'node:path';

const WRITE = process.argv.includes('--write');
const EDITOR = 'C:/Users/16263/AppData/Local/Temp/claude/C--Users-16263-Desktop-Claude-Code-Build/9d00f0c5-975e-4197-b36d-8f1eb6052b13/scratchpad/film/editor';
const CODEX = 'C:/Users/16263/Documents/Codex/2026-09-04/referenced-chatgpt-conversation-this-is-an-2';
const MEDIA = 'D:/REXX/AI_Video/BizBox-Garage-Dream';
const KIT = `${MEDIA}/garage-through-apu-review/capcut-kit-v74/SCENES_IN_ORDER`;
const DRIVE = 'G:/My Drive/00_PROJECTS/AUTOPILOT/Video 04 - Garage Dream - IN PRODUCTION';
const ROOT = `${DRIVE}/EDIT_ROOM/LYFE_STUDIO_BOARD/08_LYFE_STUDIO_SCENES__GARAGE_DREAM_EPISODE`;

const src = JSON.parse(fs.readFileSync(`${EDITOR}/board-sources.json`, 'utf8'));
const sb = JSON.parse(fs.readFileSync(`${CODEX}/scene-board/storyboard.json`, 'utf8'));
const cut = JSON.parse(fs.readFileSync('projects/garage-dream/cuts/V74.json', 'utf8'));
const inv = JSON.parse(fs.readFileSync('projects/garage-dream/INVENTORY-MANIFEST.json', 'utf8')).clips.filter(c => !c.failed);
const audRaw = JSON.parse(fs.readFileSync('projects/garage-dream/AUDIO-MANIFEST.json', 'utf8')); const aud = audRaw.clips || audRaw.items || audRaw;

const liveDirs = fs.readdirSync(`${ROOT}/LIVE_SCENES`); const archDirs = fs.readdirSync(`${ROOT}/ARCHIVE_SCENES`);
const folderFor = (list, id) => list.find(d => d.startsWith(id + '__'));
const resolve = (p) => { if (!p) return null; for (const b of [`${CODEX}/scene-board`, CODEX, `${MEDIA}/scene-board`, MEDIA]) { const f = path.resolve(b, p); if (fs.existsSync(f) && fs.statSync(f).isFile()) return f; } return null; };
const sceneIdsOfKit = (file) => { const m = file.match(/^\d+_(S[0-9]+[AB]?(?:-S[0-9]+[AB]?)*)_/); return m ? m[1].split('-') : []; };
const safe = (s) => String(s || '').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();

const plan = []; // { from, to }
function add(from, to) { if (!from || !fs.existsSync(from)) return false; plan.push({ from, to }); return true; }

for (const s of src.scenes) {
  const live = folderFor(liveDirs, s.id), arch = folderFor(archDirs, s.id) || live;
  if (!live) { console.log('no LIVE folder for', s.id); continue; }
  const L = (sub) => `${ROOT}/LIVE_SCENES/${live}/${sub}`, A = (sub) => `${ROOT}/ARCHIVE_SCENES/${arch}/${sub}`;
  // stills
  for (const t of s.stills) {
    if (!t.src) continue; const base = path.basename(t.src); const isLive = ['current', 'cut', 'approved'].includes(t.group);
    const role = t.group === 'current' ? 'CURRENT' : t.group === 'cut' ? 'CUT' : t.group === 'approved' ? 'APPROVED' : t.group === 'pending' ? 'CANDIDATE' : 'ARCHIVED';
    add(t.src, `${isLive ? L('01_STILLS_AND_REFERENCES') : A('01_STILLS_AND_REFERENCES')}/${s.id}__${role}__${base}`);
  }
  // video: V74 kit clips covering this scene
  for (const b of cut.v1) if (sceneIdsOfKit(b.file).includes(s.id)) add(`${KIT}/${b.file}`, `${L('02_VIDEO')}/${s.id}__V74-CUT__${b.file}`);
  // video: inventory clips (lip-syncs, owner uploads, Higgsfield) whose title names the scene
  const re = new RegExp(`(^|[^A-Z0-9])${s.id}([^0-9A-Z]|$)`, 'i');
  for (const c of inv) if (re.test(c.title || '') || re.test(path.basename(c.source || ''))) add(c.local, `${L('02_VIDEO')}/${s.id}__${c.group === 'owner' ? 'OWNER-UPLOAD' : c.group === 'lipsync' ? 'LIPSYNC' : 'HIGGSFIELD'}__${c.id}__${path.basename(c.source || c.file)}`);
  // video: the storyboard's own full video for the scene
  const fv = resolve(s._fullVideo || (sb.scenes.find(x => x.id === s.id) || {}).fullVideo); if (fv) add(fv, `${L('02_VIDEO')}/${s.id}__STORYBOARD-VIDEO__${path.basename(fv)}`);
  if (s.id === 'S27') add('projects/garage-dream/renders/S27-LIPSYNC-PREVIEW.mp4', `${L('02_VIDEO')}/S27__PREVIEW__S27-LIPSYNC-PREVIEW-2026-09-15.mp4`);
  // audio
  const sbs = sb.scenes.find(x => x.id === s.id) || {};
  for (const t of sbs.audioTracks || []) { const f = resolve(t.src); if (f) add(f, `${L('03_AUDIO_AND_SFX')}/${s.id}__${safe(t.label || 'audio').slice(0, 60)}__${path.basename(f)}`); }
  if (sbs.audio) { const f = resolve(sbs.audio); if (f) add(f, `${L('03_AUDIO_AND_SFX')}/${s.id}__SCENE-AUDIO__${path.basename(f)}`); }
  for (const a of aud) if (re.test(a.title || '') || re.test(a.file || '')) add(a.local || `${MEDIA}/audio-bin-v74/${a.file}`, `${L('03_AUDIO_AND_SFX')}/${s.id}__AUDIO-BIN__${a.id}__${path.basename(a.file || a.local)}`);
  // script + json (generated text, written fresh each run)
  const v74 = s.v74?.start != null ? `${s.v74.start.toFixed(2)}s – ${s.v74.end.toFixed(2)}s in V74` : (s.v74?.inCut === false ? 'left out of V74' : 'not in V74 / not built yet');
  const script = [`${s.id} · ${s.title}`, '', s.line || '', '', `Set: ${s.set || ''}${s.angle ? ' · ' + s.angle : ''}`, `Characters: ${(s.cast || []).join(', ')}`, `Props: ${(s.props || []).join(', ') || 'none noted'}`, `V74: ${v74}`, `Status: ${s.status || ''}`, s.editStatus ? `Working edit: ${s.editStatus}` : '', '', `Generated ${new Date().toISOString().slice(0, 16)} from scene-board/storyboard.json + the LYFE board. Edit the storyboard, not this file.`].filter((x) => x !== undefined).join('\n');
  plan.push({ text: script, to: `${L('04_SCRIPT_AND_DIALOGUE')}/${s.id}__SCRIPT.txt` });
  plan.push({ text: JSON.stringify(sbs, null, 2), to: `${L('05_JSON_AND_RECEIPTS')}/${s.id}__storyboard-entry.json` });
  const blocks = { v1: cut.v1.filter(b => sceneIdsOfKit(b.file).includes(s.id)), a1: (cut.a1 || []).filter(b => sceneIdsOfKit(b.file).includes(s.id)) };
  if (blocks.v1.length) plan.push({ text: JSON.stringify({ cut: 'V74', fps: cut.fps, ...blocks }, null, 2), to: `${L('05_JSON_AND_RECEIPTS')}/${s.id}__V74-cut-blocks.json` });
}

// execute
let copied = 0, skipped = 0, written = 0, bytes = 0; const perScene = {};
for (const p of plan) {
  const sid = path.basename(p.to).split('__')[0]; perScene[sid] = (perScene[sid] || 0) + 1;
  if (p.text != null) { if (WRITE) { fs.mkdirSync(path.dirname(p.to), { recursive: true }); fs.writeFileSync(p.to, p.text); } written++; continue; }
  if (fs.existsSync(p.to) && fs.statSync(p.to).size === fs.statSync(p.from).size) { skipped++; continue; }
  if (WRITE) { fs.mkdirSync(path.dirname(p.to), { recursive: true }); fs.copyFileSync(p.from, p.to, fs.constants.COPYFILE_EXCL); }
  copied++; bytes += fs.statSync(p.from).size;
}
const receipt = { mode: WRITE ? 'write' : 'dry-run', at: new Date().toISOString(), files: plan.length, copied, skippedAlreadyThere: skipped, generatedTextFiles: written, megabytes: +(bytes / 1e6).toFixed(1), perScene, sources: ['board-sources.json (build-board)', 'storyboard.json', 'cuts/V74.json', 'INVENTORY-MANIFEST.json', 'AUDIO-MANIFEST.json'] };
if (WRITE) fs.writeFileSync(`${ROOT}/00_FILL-RECEIPT.json`, JSON.stringify(receipt, null, 2));
console.log(JSON.stringify(receipt, null, 1));

// ---- characters (not Rexx: his gallery is being rebuilt and lives in 01_REXX_CHARACTER_WARDROBE), sets, props.
// Same rule as the board: approved = CURRENT, everything else = ARCHIVE. Owner ask 2026-09-15.
{
  const plan2 = [];
  const add2 = (from, to) => { if (from && fs.existsSync(from)) plan2.push({ from, to }); };
  const CH = `${ROOT}/../09_CHARACTERS__HOMER_APU_BART`, ST = `${ROOT}/../10_SETS__LOCATIONS_AND_ANGLES`, PR = `${ROOT}/../11_PROPS__MOVED_TOUCHED_MOVING`;
  for (const c of src.characters || []) {
    if (/^(rexx|other)$/i.test(c.name) || !c.refs?.length) continue;   // Rexx: being rebuilt; Other: not a character
    const nm = safe(c.name).replace(/\s+/g, '_').toUpperCase();
    for (const r of c.refs.filter(x => x.src)) add2(r.src, `${CH}/${nm}/${r.approved ? 'CURRENT' : 'ARCHIVE'}/${nm}__${r.approved ? 'APPROVED' : 'ARCHIVED'}__${safe(r.id)}__${path.basename(r.src)}`);
  }
  for (const s of src.sets || []) {
    const nm = safe(s.name).replace(/\s+/g, '_').toUpperCase();
    (s.current || []).filter(x => x.src).forEach((t, i) => add2(t.src, `${ST}/${nm}/CURRENT/${String(i + 1).padStart(2, '0')}__${nm}__${safe(t.scene || t.angle || t.id)}__${path.basename(t.src)}`));
    for (const t of (s.archive || []).filter(x => x.src)) add2(t.src, `${ST}/${nm}/ARCHIVE/${nm}__ARCHIVED__${path.basename(t.src)}`);
  }
  for (const t of (src.props || []).filter(x => x.src)) add2(t.src, `${PR}/${t.approved ? 'CURRENT' : 'ARCHIVE'}/${safe(t.title).replace(/\s+/g, '_')}__${t.approved ? 'APPROVED' : 'ARCHIVED'}__${path.basename(t.src)}`);
  let copied2 = 0, skipped2 = 0, bytes2 = 0; const per = {};
  for (const p of plan2) {
    const key = p.to.split('/').slice(-3, -1).join('/'); per[key] = (per[key] || 0) + 1;
    if (fs.existsSync(p.to) && fs.statSync(p.to).size === fs.statSync(p.from).size) { skipped2++; continue; }
    if (WRITE) { fs.mkdirSync(path.dirname(p.to), { recursive: true }); fs.copyFileSync(p.from, p.to, fs.constants.COPYFILE_EXCL); }
    copied2++; bytes2 += fs.statSync(p.from).size;
  }
  const r2 = { mode: WRITE ? 'write' : 'dry-run', at: new Date().toISOString(), files: plan2.length, copied: copied2, skippedAlreadyThere: skipped2, megabytes: +(bytes2 / 1e6).toFixed(1), perFolder: per };
  if (WRITE) fs.writeFileSync(`${ROOT}/../00_FILL-RECEIPT-CHARACTERS-SETS-PROPS.json`, JSON.stringify(r2, null, 2));
  console.log('characters/sets/props:', JSON.stringify(r2, null, 1));
}
