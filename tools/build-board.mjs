// Build the STORYBOARD data for LYFE Studio from the SOURCE OF TRUTH (Codex's scene-board/storyboard.json,
// continuity-reference-pack/reference-lock.json, real-prop manifest). VIEW build only; never writes back.
// v3 (owner, 2026-09-15): sets show ONE best image per camera angle in scene order; everything older goes to an
// archive you open with a tap. Same for characters and props (approved = current). Stairs carries the outfit stills.
// Thumbnails are packed into SHEETS (one JPEG per group) so the hosted page stays far under its 512-file cap.
//   node tools/build-board.mjs
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { syncSources } from './source-sync.mjs';
import { MEDIA_ROOT, EDITOR_DIR, PC_SOURCE, SERVER, mapPath } from './paths.mjs';

const W = PC_SOURCE || MEDIA_ROOT + '/codex-workspace';
const MEDIA = MEDIA_ROOT;
const EDITOR = EDITOR_DIR;
const invClips = fs.existsSync('projects/garage-dream/INVENTORY-MANIFEST.json') ? JSON.parse(fs.readFileSync('projects/garage-dream/INVENTORY-MANIFEST.json', 'utf8')).clips.filter(c => !c.failed) : [];
const V74_DATE = '2026-09-14';
fs.mkdirSync(EDITOR + '/sheets', { recursive: true });
const SRC = syncSources();   // canonical source is projects/garage-dream/source/ in this repo (2026-09-16)
const sb = JSON.parse(fs.readFileSync(SRC.storyboard, 'utf8'));
const lock = JSON.parse(fs.readFileSync(SRC.lock, 'utf8'));
let props = {}; try { props = JSON.parse(fs.readFileSync(W + '/environment-reference-pack/real-prop-references/manifest.json', 'utf8')); } catch (e) {}
let audioBin = []; try { audioBin = JSON.parse(fs.readFileSync('projects/garage-dream/AUDIO-MANIFEST.json', 'utf8')).clips; } catch (e) {}

// playable URLs: repo deliveries first; on the server, files made there (uploads) live under /editor/
const clipUrl = id => fs.existsSync(path.resolve('projects/garage-dream/deliveries/CLIPS/' + id + '.mp4')) ? '../projects/garage-dream/deliveries/CLIPS/' + id + '.mp4' : (SERVER && fs.existsSync(EDITOR + '/clips/' + id + '.mp4') ? '/editor/clips/' + id + '.mp4' : null);
const audioUrl = id => fs.existsSync(path.resolve('projects/garage-dream/deliveries/AUDIO/' + id + '.mp3')) ? '../projects/garage-dream/deliveries/AUDIO/' + id + '.mp3' : (SERVER && fs.existsSync(EDITOR + '/audio/' + id + '.mp3') ? '/editor/audio/' + id + '.mp3' : null);
const resolve = (p, base) => { if (!p || typeof p !== 'string') return null; p = mapPath(p); for (const b of [base, W + '/scene-board', W]) { const f = path.resolve(b, p); if (fs.existsSync(f) && fs.statSync(f).isFile()) return f; } return null; };
const dateOf = f => { try { return fs.statSync(f).mtime.toISOString().slice(0, 10); } catch (e) { return null; } };
const clean = s => (s || '').replace(/\s+/g, ' ').trim();
const base = p => path.basename(p).replace(/\.[^.]+$/, '');

// ---- sheet packer: tiles carry {sheet, col, row, cols, rows}; one JPEG per group
const SHEETS = []; const CELL = { land: [320, 180], port: [240, 320] };
function pack(groupId, srcs, shape = 'land') {
  const list = [...new Set(srcs.filter(Boolean))]; if (!list.length) return new Map();
  const [cw, ch] = CELL[shape]; const cols = Math.min(8, list.length); const rows = Math.ceil(list.length / cols);
  const file = `sheets/${groupId}.jpg`; const dest = `${EDITOR}/${file}`;
  const args = ['-v', 'error', '-nostdin', '-y']; list.forEach(p => args.push('-i', p));
  const fc = list.map((_, i) => `[${i}]scale=${cw}:${ch}:force_original_aspect_ratio=increase,crop=${cw}:${ch},setsar=1[t${i}]`).join(';');
  let graph;
  if (list.length === 1) graph = fc.replace('[t0]', '[out]'); else { const layout = list.map((_, i) => `${(i % cols) * cw}_${Math.floor(i / cols) * ch}`).join('|'); graph = fc + ';' + list.map((_, i) => `[t${i}]`).join('') + `xstack=inputs=${list.length}:layout=${layout}:fill=black[out]`; }
  const script = `${EDITOR}/sheets/${groupId}.graph`; fs.writeFileSync(script, graph);  // the graph goes in a file: 100+ inputs would blow the Windows command-line limit
  const r = spawnSync('ffmpeg', [...args, '-filter_complex_script', script, '-map', '[out]', '-frames:v', '1', '-q:v', '5', dest], { stdio: 'pipe', maxBuffer: 64e6 });
  if (r.error || r.status !== 0) { console.warn('sheet failed', groupId, list.length, 'inputs', r.error ? r.error.message : r.stderr.toString().slice(-300)); return new Map(); }
  try { fs.unlinkSync(script); } catch (e) {}
  SHEETS.push(file);
  return new Map(list.map((p, i) => [p, { sheet: file, col: i % cols, row: Math.floor(i / cols), cols, rows, shape }]));
}
const tile = (src, o) => ({ src, date: dateOf(src), file: src ? path.basename(src) : null, ...o });
const bind = (tiles, map) => tiles.map(t => { const { src, ...rest } = t; return { ...rest, img: src && map.get(src) ? map.get(src) : null }; });

// ---- first-pass cast / props / set per scene (owner corrects on the cards)
const SET = { S01: ['Stairs', 'coming down the stairs'], S02: ['Coffee', 'counter'], S03: ['Coffee', 'counter, phone'], S04: ['Coffee', 'counter, phone down'], S05: ['Coffee', 'counter'], S06: ['Waymo', 'from the back, boarding'], S07: ['Waymo', 'from below, inside, exit'], S08: ['Driveway', 'walk-up'], S09: ['Driveway', 'garage door, conversation'], S10: ['Garage', 'reveal'], S11: ['Garage', 'doorway'], S12: ['Garage', 'speakers, phone camera'], S13: ['Garage', 'explanation'], S14: ['Garage', 'recliner'], S15: ['Garage', 'standing'], S16: ['Garage', 'recliner, doze'], S17: ['PCH road (dream)', 'Bugatti rear'], S18: ['Garage', 'recliner close-up, mosquito'], S19: ['Driveway', 'Bart skates'], S20: ['Garage', 'recliner'], S21: ['Garage', 'recliner'], S22: ['Garage', 'recliner'], S23: ['Driveway', 'Apu arrives'], S24: ['Driveway', 'rear wide, walk to car'], S27: ["Apu's car", 'driver window'], S28: ["Apu's car", 'passenger seat'], S29: ["Apu's car", 'fist bump'], S29A: ['Road', 'passenger window'], S29B: ['Road', 'bus stop'], S30: ["Apu's car", 'interior'], S31: ["Apu's car", 'interior'], S32: ["Apu's car", 'passenger window'], S33: ['Vintage Mart', 'storefront'], S34: ['Vintage Mart', 'arrival'], S35: ['Vintage Mart', 'interior racks'] };
const CAST = id => { const num = +id.replace(/[AB]$/, '').slice(1); if (num <= 2) return ['Rexx']; if (num <= 5) return ['Rexx', 'Homer (on the phone)']; if (num <= 7) return ['Rexx']; if (num <= 18) return ['Rexx', 'Homer']; if (num <= 22) return ['Rexx', 'Homer', 'Bart']; if (num <= 29) return ['Rexx', 'Homer', 'Apu']; return ['Rexx', 'Apu']; };
const PROPS = { S02: ['phone', 'coffee mug'], S03: ['phone'], S04: ['phone', 'coffee mug'], S05: ['coffee mug', 'phone'], S07: ['phone'], S09: ['garage remote'], S10: ['boxes', 'consoles', 'Hot Wheels', 'treadmill', 'recliner'], S12: ['phone', 'speakers'], S14: ['recliner'], S16: ['recliner'], S17: ['Bugatti La Voiture Noire'], S18: ['mosquito', 'recliner'], S19: ['skateboard', 'slingshot'], S20: ['slingshot', 'recliner'], S21: ['recliner'], S22: ['recliner'], S23: ['Firebird (car)'], S27: ['Firebird (car)'], S28: ['Firebird (car)'], S29: ['Firebird (car)'], S30: ['Happy Gas tank'], S31: ['Happy Gas tank'], S32: ['Happy Gas tank'] };

// ---- scenes: every still (current, cut start/end, approved, candidates, archived), audio, script, cast, props, set
const scenes = sb.scenes.map(s => {
  const stills = [];
  const cur = resolve(s.image, W + '/scene-board'); if (cur) stills.push(tile(cur, { group: 'current', id: s.id + '-current', title: s.imageSource ? `Current still · from ${s.imageSource.cut}` : 'Current still', role: 'current', approved: true, status: s.imageSource ? `taken from ${s.imageSource.file} at ${s.imageSource.atSeconds}s` : '' }));
  for (const f of s.currentCutFrames || []) { const p = resolve(f.image, W + '/scene-board'); if (p) stills.push(tile(p, { group: 'cut', id: f.id || f.image, title: clean(f.title), role: /end/i.test(f.title) ? 'end' : /start/i.test(f.title) ? 'start' : 'cut', approved: true, status: '' })); }
  for (const f of s.frames || []) { const p = resolve(f.image, W + '/scene-board'); if (p) stills.push(tile(p, { group: 'approved', id: f.id, title: clean(f.title), caption: clean(f.caption), role: /end/i.test(f.role || f.title) ? 'end' : /start/i.test(f.role || f.title) ? 'start' : 'reference', approved: true, status: clean(f.status) })); }
  for (const f of s.pendingFrames || []) { const p = resolve(f.image, W + '/scene-board'); if (p) stills.push(tile(p, { group: 'pending', id: f.id, title: clean(f.title), caption: clean(f.caption), role: /end/i.test(f.role || '') ? 'end' : /start/i.test(f.role || '') ? 'start' : 'candidate', approved: !!f.approved, status: clean(f.status) })); }
  for (const f of s.archivedFrames || []) { const p = resolve(f.image, W + '/scene-board'); if (p) stills.push(tile(p, { group: 'archived', id: f.id, title: clean(f.title), caption: clean(f.caption), role: /end/i.test(f.role || '') ? 'end' : /start/i.test(f.role || '') ? 'start' : 'archived', approved: false, status: clean(f.status) })); }
  // clip tiles: lip-syncs, Higgsfield renders and owner uploads filed to this scene show as stills too (thumb = first frame). 2026-09-15
  const ownerIn = new Set([...(s.ownerAddedClips || []), ...(s.ownerMovedIn || []).map(m => m.id)]);
  for (const c of invClips.filter(c => ownerIn.has(c.id) || new RegExp('(^|[^A-Z0-9])' + s.id + '([^0-9A-Z]|$)', 'i').test(c.title || ''))) { const th = EDITOR + '/thumbs/' + c.id + '.jpg'; if (fs.existsSync(th)) stills.push(tile(th, { videoUrl: clipUrl(c.id), group: (s.archivedClipIds || []).includes(c.id) ? 'archived' : (s.approvedClipIds || []).includes(c.id) ? 'approved' : c.group === 'owner' ? 'cut' : 'pending', approved: (s.approvedClipIds || []).includes(c.id), id: c.id, title: (c.group === 'owner' ? 'Owner upload · ' : c.group === 'lipsync' ? 'Lip-sync clip · ' : 'Higgsfield clip · ') + c.id + ' · ' + c.seconds + ' s', role: 'clip', approved: c.group === 'owner', status: c.title, file: c.file })); }
  const kw = new RegExp('\\b' + s.id + '\\b', 'i');
  const ownerAud = new Set(s.ownerAddedAudio || []);
  const audio = audioBin.filter(a => ownerAud.has(a.id) || kw.test(a.title) || kw.test(a.file) || (s.id === 'S19' && /bart/i.test(a.title)) || (s.id === 'S16' && /whisper|bugatti intro/i.test(a.title)) || (s.id === 'S07' && /waymo/i.test(a.title)) || (s.id === 'S18' && /snore|mosquito/i.test(a.title)) || (s.id === 'S17' && /song|bugatti phrase/i.test(a.title))).map(a => ({ id: a.id, title: a.title, group: a.group, audioUrl: audioUrl(a.id), seconds: a.seconds, date: (a.local && dateOf(a.local)) || null }));
  const hist = (s.audioRevisionHistory || []).map(h => typeof h === 'string' ? clean(h) : clean(h.note || h.status || JSON.stringify(h)).slice(0, 160));
  { const rej = new Set(s.ownerRejected || []), arc = new Set(s.ownerArchived || []);
    for (let i = stills.length - 1; i >= 0; i--) { const t = stills[i]; const keys = [t.id, t.id && String(t.id).split('/').pop()];
      if (keys.some(k => rej.has(k))) stills.splice(i, 1);
      else if (keys.some(k => arc.has(k))) { t.group = 'archived'; t.approved = false; } } }
  const [setName, angle] = SET[s.id] || ['', ''];
  const sheet = pack('scene-' + s.id, stills.map(t => t.src));
  return { id: s.id, title: s.title, inFilm: s.assembly?.active !== false, sceneVideoUrl: SERVER && fs.existsSync(EDITOR + '/scenes/' + s.id + '.mp4') ? '/editor/scenes/' + s.id + '.mp4' : fs.existsSync(path.resolve("projects/garage-dream/deliveries/SCENES/" + s.id + ".mp4")) ? "../projects/garage-dream/deliveries/SCENES/" + s.id + ".mp4" : null, removedWhy: s.assembly?.active === false ? clean(s.assembly.reason) : "", line: clean(s.line), status: clean(s.status), nextAction: clean(s.finalization?.nextAction), gate: clean(s.productionGate?.reason), video: s.fullVideo ? path.basename(s.fullVideo) : null, editStatus: clean(s.editStatus || s.latestWorkingEdit?.status),
    still: cur && sheet.get(cur) ? sheet.get(cur) : null, stillDate: dateOf(cur), stillStale: !!(cur && dateOf(cur) < V74_DATE),
    v74: s.v74?.episodeSeconds ? { start: s.v74.episodeSeconds[0], end: s.v74.episodeSeconds[1] } : (s.v74?.inCut === false ? { inCut: false, note: s.v74.note } : null),
    stills: bind(stills, sheet), audio, audioHistory: hist, cast: CAST(s.id), props: PROPS[s.id] || [], set: setName, angle, _cur: cur, _frames: s.frames || [], _src: stills.map(t => ({ src: t.src, id: t.id, title: t.title, group: t.group, role: t.role, approved: !!t.approved, date: t.date })), _audioSrc: audio.map(a => ({ src: a.src || a.path || a.file, id: a.id, title: a.title, seconds: a.seconds })), _fullVideo: s.fullVideo || null, _audioTracks: (s.audioTracks || []).map(t => ({ src: t.src, label: t.label })) };
});

// ---- characters: approved = current tiles; the rest is the archive
const chars = {}; const order = ['Rexx', 'Homer', 'Apu', 'Bart'];
const viewOf = t => /rear|behind|back/i.test(t) ? 'behind' : /left/i.test(t) ? 'left side' : /right/i.test(t) ? 'right side' : /three.angle|head/i.test(t) ? 'head' : /full.body|full-length/i.test(t) ? 'full body' : /outfit|shirt|pants|dickies|shoe|heel|hat/i.test(t) ? 'outfit' : /dream/i.test(t) ? 'dream look' : 'reference';
const isPropNotCharacter = it => /slingshot|fork|kobe|grinch|heel|shoe/i.test((it.id || '') + ' ' + (it.title || ''));   // wardrobe/prop references filed under a character name
for (const g of lock.groups || []) for (const it of g.items || []) { if (isPropNotCharacter(it)) continue; const c = it.character || 'Other'; (chars[c] ||= { name: c, refs: [] }); chars[c].refs.push(tile(resolve(it.path, W), { id: it.id, title: it.title, role: clean(it.role), notes: clean(it.notes), approved: !!it.approved, status: clean(it.status), group: g.title, view: viewOf(it.title + ' ' + (it.role || '')) })); }
for (const [name, c] of Object.entries(sb.characterContinuity || {})) { (chars[name] ||= { name, refs: [] }); chars[name].continuity = Object.fromEntries(Object.entries(c).filter(([k, v]) => typeof v === 'string').map(([k, v]) => [k, clean(v)])); }
for (const [name, v] of Object.entries(sb.characterReferences?.voiceProfiles || {})) { (chars[name] ||= { name, refs: [] }); chars[name].voice = { voiceName: v.voiceName, voiceId: v.voiceId, model: v.model, status: clean(v.status) }; }
for (const c of sb.characterReferences?.characters || []) { const k = c.name; (chars[k] ||= { name: k, refs: [] }); chars[k].status = clean(c.status); }
const dh = sb.characterReferences?.dreamHomer; if (dh) (chars.Homer ||= { name: 'Homer', refs: [] }).refs.push(tile(resolve(dh.path, W), { id: dh.id, title: dh.title, role: clean(dh.role), notes: clean(dh.notes), approved: !!dh.approved, status: clean(dh.status), group: 'Dream look', view: 'dream look' }));
const characters = [...order.filter(k => chars[k]).map(k => chars[k]), ...Object.keys(chars).filter(k => !order.includes(k)).map(k => chars[k])].map(c => { const m = pack('char-' + c.name.replace(/\W+/g, '_'), c.refs.map(t => t.src), 'port'); const refs = bind(c.refs, m); const cur = refs.filter(r => r.approved), rest = refs.filter(r => !r.approved);
  // a character with nothing approved shows its candidates up top (owner 2026-09-15: 'there's no Apu, no Bart'); they keep the candidate badge until approved
  const noApproved = cur.length === 0 && rest.length > 0;
  return { name: c.name, status: c.status, voice: c.voice, continuity: c.continuity, noApproved, current: noApproved ? rest.map(r => ({ ...r, group: 'pending' })) : cur, archive: noApproved ? [] : rest }; });

// ---- SETS: places. Current = one best image per camera angle (the V74 still of each scene in that set, in scene
// order, plus the approved START/END references and the set master). Archive = every other render filed to that set.
const env = sb.environmentReferences || {};
const sceneSet = id => (SET[id] || [''])[0];
const SCAN = [
  'D:/REXX/AI_Video/BizBox-Garage-Dream/character-references/rexx/2026-09-15',   // Rexx seven rear views, owner-selected 2026-09-15 (Codex PR bizbox#16)
  'environment-reference-pack/s09-door-action', 'environment-reference-pack/garage-reveal-sequence', 'environment-reference-pack/garage-scenes-v3', 'environment-reference-pack/garage-scenes-v4', 'environment-reference-pack/garage-scenes-v5', 'environment-reference-pack/set-angles-v4', 'environment-reference-pack/shoulder-pass-v1', 'environment-reference-pack/scene-rebuild-v6', 'environment-reference-pack/scene-rebuild-v7', 'environment-reference-pack/driveway-sequence', 'environment-reference-pack/bugatti-dream-sequence', 'environment-reference-pack/bugatti-la-voiture-noire', 'environment-reference-pack/vintage-v2', 'waymo-review', 'opening-review', 'apu-arrival-review', 'worker-pch-empty-road-v1', 'closing-review', 'phone-reference-20260910', 'continuity-reference-pack', 'garage-lipsync-review', 'garage-through-apu-review/s24-reference-rebuild-v3'];
const classify = (dir, name) => {
  const f = name.toUpperCase(); if (/^(REXX|HOMER|APU|BART)[-_]/.test(f) && !/STAIR/.test(f)) return null;
  const m = f.match(/(?:^|[^A-Z0-9])(S[0-9]{2})(?:[^0-9]|$)/); if (m && sceneSet(m[1])) return sceneSet(m[1]);
  if (/STAIR/.test(f)) return 'Stairs';
  if (/VINTAGE|KWIK/.test(f) || /vintage/i.test(dir)) return 'Vintage Mart';
  if (/BUGATTI|PCH|EMPTY-ROAD|HIGHWAY/.test(f) || /bugatti|pch/i.test(dir)) return 'PCH road (dream)';
  if (/WAYMO/.test(f) || /waymo/i.test(dir)) return 'Waymo';
  if (/COFFEE|KITCHEN|COUNTER|PHONE/.test(f) || /phone-reference|opening/i.test(dir)) return 'Coffee';
  if (/BALCONY|DECK/.test(f)) return /UPPER|UPSTAIRS/.test(f) ? 'Upstairs balcony' : 'Outside balcony';
  if (/DRIVEWAY|WALKUP|WALK-UP/.test(f) || /driveway/i.test(dir)) return 'Driveway';
  if (/APU|FIREBIRD|PONTIAC|PASSENGER|FIST|CAR-/.test(f) || /apu-arrival|closing/i.test(dir)) return "Apu's car";
  if (/GARAGE|DOOR|RECLINER|TREADMILL|SHELF|SHOULDER|REVEAL|MASTER|HOT-WHEELS|SMITTY/.test(f) || /garage|s09-door|set-angles|shoulder/i.test(dir)) return 'Garage';
  return null;
};
const bySet = {}; const seenFile = new Set();
for (const dir of SCAN) { const d = W + '/' + dir; if (!fs.existsSync(d)) continue; for (const f of fs.readdirSync(d)) { if (!/[.](png|jpe?g)$/i.test(f) || /CONTACT|SHEET|CROP|AUDIT|QC|TILE|GRID|INSPECTION|REPAIRED/i.test(f)) continue; const p = d + '/' + f; if (!fs.statSync(p).isFile()) continue; const key = f.toLowerCase(); if (seenFile.has(key)) continue; const set = classify(dir, f); if (!set) continue; seenFile.add(key); (bySet[set] ||= []).push(p); } }
// Stairs: the outfit stills (Higgsfield 2026-09-08 wardrobe series) are the angles the owner asked for
const STAIRS_DIR = MEDIA + '/stairs-outfits-2026-09-08'; const stairsOutfits = fs.existsSync(STAIRS_DIR) ? fs.readdirSync(STAIRS_DIR).filter(f => /[.](png|jpe?g)$/i.test(f)).sort().map(f => STAIRS_DIR + '/' + f) : [];
const SETS_ORDER = [['Stairs', 'Opening. Rexx comes down the stairs. One still per outfit.'], ['Coffee', 'Kitchen counter. Coffee, the phone call.'], ['Outside balcony', 'Lower balcony.'], ['Upstairs balcony', 'Upper deck.'], ['Waymo', 'From the back and from below. That is the whole set.'], ['Driveway', "Homer's driveway, garage door, Apu's arrival."], ['Garage', 'Closed or open, one set: reveal, recliner, treadmill, shelves.'], ['PCH road (dream)', "Homer's Bugatti dream on the empty PCH."], ["Apu's car", 'The Firebird: driver window, passenger seat, fist bump.'], ['Vintage Mart', 'Former Kwik-E-Mart. Future episodes.'], ['Road', 'Passenger-window travel, bus stop (future).']];
// owner uploads (Drive → D:/owner-uploads via tools/ingest-drive-uploads.mjs): sets by folder name, props flat. 2026-09-15
const OWN = MEDIA + '/owner-uploads'; const walkFiles = d => fs.existsSync(d) ? fs.readdirSync(d).flatMap(f => { const q = d + '/' + f; return fs.statSync(q).isDirectory() ? walkFiles(q) : (/[.](png|jpe?g|webp)$/i.test(f) ? [q] : []); }) : [];
if (fs.existsSync(OWN + '/sets')) for (const n of fs.readdirSync(OWN + '/sets')) { const key = SETS_ORDER.map(x => x[0]).find(x => x.toLowerCase() === n.toLowerCase()) || n; (bySet[key] ||= []).push(...walkFiles(OWN + '/sets/' + n)); }
const sets = SETS_ORDER.map(([name, blurb]) => {
  const inSet = scenes.filter(s => s.set === name);
  const current = []; const seen = new Set();
  const add = (src, o) => { if (!src || seen.has(src)) return; seen.add(src); current.push(tile(src, o)); };
  if (name === 'Garage') add(resolve(env.garageMaster, W), { id: 'garage-master', title: 'Garage master set', angle: 'master', approved: true });
  for (const s of inSet) {
    add(s._cur, { id: s.id + '-angle', title: `${s.id} · ${s.angle}`, angle: s.angle, scene: s.id, approved: true });
    for (const fr of s._frames) { const role = /end/i.test(fr.role || fr.title) ? 'end' : /start/i.test(fr.role || fr.title) ? 'start' : null; if (!role) continue; add(resolve(fr.image, W + '/scene-board'), { id: fr.id, title: `${s.id} · ${role.toUpperCase()} · ${clean(fr.title)}`, angle: s.angle, scene: s.id, approved: true, role }); }
  }
  if (name === 'Stairs') stairsOutfits.forEach((p, i) => add(p, { id: 'outfit-' + (i + 1), title: `Outfit ${i + 1}`, angle: 'coming down the stairs', approved: true }));
  const archive = [...new Set(bySet[name] || [])].filter(p => !seen.has(p)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs).map(p => tile(p, { id: base(p), title: base(p).replace(/[-_]/g, ' ') }));
  const m = pack('set-' + name.replace(/\W+/g, '_'), [...current, ...archive].map(t => t.src));
  const strip = t => ({ src: t.src, id: t.id, title: t.title, angle: t.angle, scene: t.scene, date: t.date, approved: !!t.approved });
  return { name, blurb, scenes: inSet.map(s => s.id), current: bind(current, m), archive: bind(archive, m), _current: current.map(strip), _archive: archive.map(strip) };
});

// ---- PROPS: things moved, touched, or moving. Approved references are current; the rest is archive.
const propTiles = [];
const addProp = (title, p, role, status, extra = {}) => { const f = resolve(p, W); propTiles.push(tile(f, { id: title, title, role: clean(role), status: clean(status), ...extra })); };
const bs = sb.characterReferences?.bartSlingshot; if (bs) addProp('Slingshot (Bart)', bs.path, bs.role, bs.status, { approved: !!bs.approved });
if (env.dreamVehicle) addProp('Bugatti La Voiture Noire (dream car)', env.dreamVehicle.path, env.dreamVehicle.role, env.dreamVehicle.status, { approved: !!env.dreamVehicle.approved });
for (const it of props.items || props.references || props.props || []) addProp(it.title || it.id || 'prop', it.path || it.file || it.image, it.role || it.notes || '', it.status || '', { approved: !!it.approved });
const rp = W + '/environment-reference-pack/real-prop-references'; if (fs.existsSync(rp)) for (const f of fs.readdirSync(rp).filter(f => /[.](png|jpe?g)$/i.test(f))) if (!propTiles.some(t => t.file === f)) addProp(base(f).replace(/[-_]/g, ' '), rp + '/' + f, '', '');
for (const name of ['phone', 'coffee mug', 'garage remote', 'boxes', 'consoles', 'Hot Wheels', 'treadmill', 'recliner', 'speakers', 'mosquito', 'skateboard', 'Firebird (car)', 'Happy Gas tank']) if (!propTiles.some(t => t.title.toLowerCase().includes(name.toLowerCase()))) propTiles.push({ id: name, title: name, role: 'used in ' + scenes.filter(s => s.props.includes(name)).map(s => s.id).join(', '), src: null, date: null, status: 'no reference image yet', approved: false });
for (const f of walkFiles(OWN + '/props')) if (!propTiles.some(t => t.src === f || (t.file && t.file.toLowerCase() === base(f).toLowerCase() + path.extname(f).toLowerCase()))) propTiles.push(tile(f, { id: 'owner-' + base(f), title: base(f).replace(/[-_]/g, ' ') + ' (owner upload)', role: 'candidate', status: 'Owner upload — awaiting approval', approved: false }));
const propsBound = bind(propTiles, pack('props', propTiles.map(t => t.src)));

for (const s of scenes) { delete s._cur; delete s._frames; }
const objects = [...sets.flatMap(st => st.current.map(a => ({ title: st.name + ' · ' + a.title, role: 'set angle', status: '', img: a.img, date: a.date, approved: true }))), ...propsBound.map(p => ({ title: p.title, role: p.role, status: p.status, img: p.img, date: p.date, approved: !!p.approved }))];
// The film itself: the newest render under deliveries/FILM (published with the repo; GitHub Pages serves it with no login). 2026-09-15
const FILMDIR = path.resolve('projects/garage-dream/deliveries/FILM');
const filmList = [];
if (fs.existsSync(FILMDIR)) for (const f of fs.readdirSync(FILMDIR)) if (/\.mp4$/i.test(f)) filmList.push({ file: f, abs: path.join(FILMDIR, f), url: '../projects/garage-dream/deliveries/FILM/' + f });
if (SERVER && fs.existsSync(EDITOR + '/films')) for (const f of fs.readdirSync(EDITOR + '/films')) if (/\.mp4$/i.test(f)) filmList.push({ file: f, abs: EDITOR + '/films/' + f, url: '/editor/films/' + f });
filmList.sort((x, y) => fs.statSync(y.abs).mtimeMs - fs.statSync(x.abs).mtimeMs);
const F0 = filmList[0];
const FILM = F0 ? { file: F0.file, name: F0.file.replace(/\.mp4$/i, '').replace(/-/g, ' '), urls: [F0.url, F0.file], bytes: fs.statSync(F0.abs).size, builtAt: new Date(fs.statSync(F0.abs).mtimeMs).toISOString() } : null;
// Library: every shelf clip with a web proxy + every audio file, so the owner can add any of them to any scene from the page (2026-09-16)
const LIBRARY = { clips: invClips.filter(c => clipUrl(c.id)).map(c => ({ id: c.id, title: c.title || c.file, date: c.date || c.at, group: c.group, videoUrl: clipUrl(c.id) })), audio: audioBin.filter(a => audioUrl(a.id)).map(a => ({ id: a.id, title: a.title, seconds: a.seconds, audioUrl: audioUrl(a.id) })) };
const board = { format: 3, film: FILM, library: LIBRARY, v74Date: V74_DATE, source: 'Codex scene-board/storyboard.json + reference-lock.json (VIEW build; never writes back)', builtAt: new Date().toISOString(), version: sb.version, currentCut: sb.currentFullCut?.title, scenes, characters, sets, props: { current: propsBound.filter(p => p.approved), archive: propsBound.filter(p => !p.approved) }, objects, sheets: SHEETS, lockStatus: clean(lock.status), blockers: (lock.blockers || []).map(clean) };
// Source map for the Drive per-scene folders (tools/fill-drive-scene-folders.mjs): the real file paths behind every tile.
fs.writeFileSync(EDITOR + '/board-sources.json', JSON.stringify({ builtAt: new Date().toISOString(), scenes: scenes.map(s => ({ id: s.id, title: s.title, line: s.line, status: s.status, set: s.set, angle: s.angle, cast: s.cast, props: s.props, v74: s.v74, video: s.video, editStatus: s.editStatus, current: s._cur || null, stills: (s._src || []), audio: (s._audioSrc || []) })), characters: Object.values(chars).map(c => ({ name: c.name, refs: c.refs.map(t => ({ src: t.src, id: t.id, title: t.title, role: t.role, approved: !!t.approved, date: t.date })) })), sets: sets.map(x => ({ name: x.name, scenes: x.scenes, current: x._current, archive: x._archive })), props: propTiles.map(t => ({ src: t.src, id: t.id, title: t.title, role: t.role, approved: !!t.approved, date: t.date })) }, null, 1));
for (const x of sets) { delete x._current; delete x._archive; }   // sources only, not for the view
fs.writeFileSync(EDITOR + '/board.json', JSON.stringify(board, null, 1));
fs.writeFileSync('projects/garage-dream/STORYBOARD-BOARD.json', JSON.stringify(board, null, 2));
console.log(`board v3: ${scenes.length} scenes / ${scenes.reduce((s, x) => s + x.stills.length, 0)} stills · ${characters.length} characters (${characters.reduce((s, c) => s + c.current.length, 0)} current + ${characters.reduce((s, c) => s + c.archive.length, 0)} archived) · ${sets.length} sets (${sets.reduce((s, x) => s + x.current.length, 0)} angles + ${sets.reduce((s, x) => s + x.archive.length, 0)} archived) · props ${board.props.current.length} + ${board.props.archive.length} · ${SHEETS.length} sheets`);
for (const st of sets) console.log('  ', st.name.padEnd(18), 'angles', String(st.current.length).padStart(3), 'archive', st.archive.length);
