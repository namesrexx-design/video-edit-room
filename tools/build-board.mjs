// Build the STORYBOARD data + thumbnails for LYFE Studio from the SOURCE OF TRUTH (Codex's
// scene-board/storyboard.json + continuity-reference-pack/reference-lock.json + real-prop manifest).
// v2 (2026-09-15, owner spec SPEC-LYFE-STUDIO-EDITING.md): every scene carries ALL its stills
// (current cut, approved, pending, archived; start/end roles kept), audio, script, cast, props, set + angle;
// characters / sets / props are tiles. This is a VIEW build: it never writes back to the source.
//   node tools/build-board.mjs
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const W = 'C:/Users/16263/Documents/Codex/2026-09-04/referenced-chatgpt-conversation-this-is-an-2';
const EDITOR = 'C:/Users/16263/AppData/Local/Temp/claude/C--Users-16263-Desktop-Claude-Code-Build/9d00f0c5-975e-4197-b36d-8f1eb6052b13/scratchpad/film/editor';
const V74_DATE = '2026-09-14';
fs.mkdirSync(EDITOR + '/sb', { recursive: true });
const sb = JSON.parse(fs.readFileSync(W + '/scene-board/storyboard.json', 'utf8'));
const lock = JSON.parse(fs.readFileSync(W + '/continuity-reference-pack/reference-lock.json', 'utf8'));
let props = {}; try { props = JSON.parse(fs.readFileSync(W + '/environment-reference-pack/real-prop-references/manifest.json', 'utf8')); } catch (e) {}
let audioBin = []; try { audioBin = JSON.parse(fs.readFileSync('projects/garage-dream/AUDIO-MANIFEST.json', 'utf8')).clips; } catch (e) {}

const resolve = (p, base) => { if (!p || typeof p !== 'string') return null; for (const b of [base, W + '/scene-board', W]) { const f = path.resolve(b, p); if (fs.existsSync(f) && fs.statSync(f).isFile()) return f; } return null; };
const dateOf = f => { try { return fs.statSync(f).mtime.toISOString().slice(0, 10); } catch (e) { return null; } };
const clean = s => (s || '').replace(/\s+/g, ' ').trim();
let n = 0; const thumbs = new Map();
function thumb(src) {
  if (!src) return null; if (thumbs.has(src)) return thumbs.get(src);
  const id = 'sb' + String(++n).padStart(3, '0') + '.jpg'; const dest = `${EDITOR}/sb/${id}`;
  if (!fs.existsSync(dest)) { const r = spawnSync('ffmpeg', ['-v', 'error', '-nostdin', '-n', '-i', src, '-frames:v', '1', '-vf', "scale='min(720,iw)':-2", '-q:v', '5', dest], { stdio: 'pipe' }); if (r.status !== 0) { thumbs.set(src, null); return null; } }
  thumbs.set(src, 'sb/' + id); return 'sb/' + id;
}
const tile = (src, o) => ({ img: thumb(src), date: dateOf(src), file: src ? path.basename(src) : null, ...o });

// ---- first-pass cast / props / set per scene (owner corrects on the cards)
const SET = { S01: ['Stairs', 'descent'], S02: ['Coffee', 'counter'], S03: ['Coffee', 'counter, phone'], S04: ['Coffee', 'counter, phone down'], S05: ['Coffee', 'counter'], S06: ['Waymo', 'boarding, exterior'], S07: ['Waymo', 'interior ride, exit'], S08: ['Driveway', 'walk-up'], S09: ['Driveway', 'garage door, conversation'], S10: ['Garage', 'reveal'], S11: ['Garage', 'doorway'], S12: ['Garage', 'speakers, phone camera'], S13: ['Garage', 'explanation'], S14: ['Garage', 'recliner'], S15: ['Garage', 'standing'], S16: ['Garage', 'recliner, doze'], S17: ['PCH road (dream)', 'Bugatti rear'], S18: ['Garage', 'recliner close-up, mosquito'], S19: ['Driveway', 'Bart skates'], S20: ['Garage', 'recliner'], S21: ['Garage', 'recliner'], S22: ['Garage', 'recliner'], S23: ['Driveway', 'Apu arrives'], S24: ['Driveway', 'rear wide, walk to car'], S27: ['Apu\'s car', 'driver window'], S28: ['Apu\'s car', 'passenger seat'], S29: ['Apu\'s car', 'fist bump'], S29A: ['Road', 'passenger window'], S29B: ['Road', 'bus stop'], S30: ['Apu\'s car', 'interior'], S31: ['Apu\'s car', 'interior'], S32: ['Apu\'s car', 'passenger window'], S33: ['Vintage Mart', 'storefront'], S34: ['Vintage Mart', 'arrival'], S35: ['Vintage Mart', 'interior racks'] };
const CAST = id => { const k = id.replace(/[AB]$/, ''); const num = +k.slice(1); if (num <= 2) return ['Rexx']; if (num <= 5) return ['Rexx', 'Homer (on the phone)']; if (num <= 7) return ['Rexx']; if (num <= 18) return ['Rexx', 'Homer']; if (num <= 22) return ['Rexx', 'Homer', 'Bart']; if (num <= 29) return ['Rexx', 'Homer', 'Apu']; return ['Rexx', 'Apu']; };
const PROPS = { S02: ['phone', 'coffee mug'], S03: ['phone'], S04: ['phone', 'coffee mug'], S05: ['coffee mug', 'phone'], S07: ['phone'], S09: ['garage remote'], S10: ['boxes', 'consoles', 'Hot Wheels', 'treadmill', 'recliner'], S12: ['phone', 'speakers'], S14: ['recliner'], S16: ['recliner'], S17: ['Bugatti La Voiture Noire'], S18: ['mosquito', 'recliner'], S19: ['skateboard', 'slingshot'], S20: ['slingshot', 'recliner'], S21: ['recliner'], S22: ['recliner'], S23: ['Firebird (car)'], S27: ['Firebird (car)'], S28: ['Firebird (car)'], S29: ['Firebird (car)'], S30: ['Happy Gas tank'], S31: ['Happy Gas tank'], S32: ['Happy Gas tank'] };

// ---- scenes
const scenes = sb.scenes.map(s => {
  const stills = [];
  const cur = resolve(s.image, W + '/scene-board'); if (cur) stills.push(tile(cur, { group: 'current', id: s.id + '-current', title: s.imageSource ? `Current still · from ${s.imageSource.cut}` : 'Current still', role: 'current', approved: true, status: s.imageSource ? `taken from ${s.imageSource.file} at ${s.imageSource.atSeconds}s` : '' }));
  for (const f of s.currentCutFrames || []) { const p = resolve(f.image, W + '/scene-board'); if (p) stills.push(tile(p, { group: 'cut', id: f.id || f.image, title: clean(f.title), role: /end/i.test(f.title) ? 'end' : /start/i.test(f.title) ? 'start' : 'cut', approved: true, status: '' })); }
  for (const f of s.frames || []) { const p = resolve(f.image, W + '/scene-board'); if (p) stills.push(tile(p, { group: 'approved', id: f.id, title: clean(f.title), caption: clean(f.caption), role: /end/i.test(f.role || f.title) ? 'end' : /start/i.test(f.role || f.title) ? 'start' : 'reference', approved: true, status: clean(f.status) })); }
  for (const f of s.pendingFrames || []) { const p = resolve(f.image, W + '/scene-board'); if (p) stills.push(tile(p, { group: 'pending', id: f.id, title: clean(f.title), caption: clean(f.caption), role: /end/i.test(f.role || '') ? 'end' : /start/i.test(f.role || '') ? 'start' : 'candidate', approved: !!f.approved, status: clean(f.status) })); }
  for (const f of s.archivedFrames || []) { const p = resolve(f.image, W + '/scene-board'); if (p) stills.push(tile(p, { group: 'archived', id: f.id, title: clean(f.title), caption: clean(f.caption), role: /end/i.test(f.role || '') ? 'end' : /start/i.test(f.role || '') ? 'start' : 'archived', approved: false, status: clean(f.status) })); }
  const kw = new RegExp('\\b' + s.id + '\\b', 'i');
  const audio = audioBin.filter(a => kw.test(a.title) || kw.test(a.file) || (s.id === 'S19' && /bart/i.test(a.title)) || (s.id === 'S16' && /whisper|bugatti intro/i.test(a.title)) || (s.id === 'S07' && /waymo/i.test(a.title)) || (s.id === 'S18' && /snore|mosquito/i.test(a.title)) || (s.id === 'S17' && /song|bugatti phrase/i.test(a.title))).map(a => ({ id: a.id, title: a.title, group: a.group, seconds: a.seconds, date: (a.local && dateOf(a.local)) || null }));
  const hist = (s.audioRevisionHistory || []).map(h => typeof h === 'string' ? clean(h) : clean(h.note || h.status || JSON.stringify(h)).slice(0, 160));
  const [setName, angle] = SET[s.id] || ['', ''];
  return { id: s.id, title: s.title, line: clean(s.line), status: clean(s.status), nextAction: clean(s.finalization?.nextAction), gate: clean(s.productionGate?.reason), video: s.fullVideo ? path.basename(s.fullVideo) : null, editStatus: clean(s.latestWorkingEdit?.status),
    still: cur ? thumb(cur) : null, stillDate: dateOf(cur), stillStale: !!(cur && dateOf(cur) < V74_DATE),
    v74: s.v74?.episodeSeconds ? { start: s.v74.episodeSeconds[0], end: s.v74.episodeSeconds[1] } : (s.v74?.inCut === false ? { inCut: false, note: s.v74.note } : null),
    stills, audio, audioHistory: hist, cast: CAST(s.id), props: PROPS[s.id] || [], set: setName, angle };
});

// ---- characters (tiles)
const chars = {}; const order = ['Rexx', 'Homer', 'Apu', 'Bart'];
const viewOf = t => /rear|behind|back/i.test(t) ? 'behind' : /left/i.test(t) ? 'left side' : /right/i.test(t) ? 'right side' : /three.angle|head/i.test(t) ? 'head' : /full.body|full-length/i.test(t) ? 'full body' : /outfit|shirt|pants|dickies|shoe|heel|hat/i.test(t) ? 'outfit' : /dream/i.test(t) ? 'dream look' : 'reference';
for (const g of lock.groups || []) for (const it of g.items || []) { const c = it.character || 'Other'; (chars[c] ||= { name: c, refs: [] }); const p = resolve(it.path, W); chars[c].refs.push(tile(p, { id: it.id, title: it.title, role: clean(it.role), notes: clean(it.notes), approved: !!it.approved, status: clean(it.status), group: g.title, view: viewOf(it.title + ' ' + (it.role || '')) })); }
for (const [name, c] of Object.entries(sb.characterContinuity || {})) { (chars[name] ||= { name, refs: [] }); chars[name].continuity = Object.fromEntries(Object.entries(c).filter(([k, v]) => typeof v === 'string').map(([k, v]) => [k, clean(v)])); }
for (const [name, v] of Object.entries(sb.characterReferences?.voiceProfiles || {})) { (chars[name] ||= { name, refs: [] }); chars[name].voice = { voiceName: v.voiceName, voiceId: v.voiceId, model: v.model, status: clean(v.status) }; }
for (const c of sb.characterReferences?.characters || []) { const k = c.name; (chars[k] ||= { name: k, refs: [] }); chars[k].status = clean(c.status); }
const dh = sb.characterReferences?.dreamHomer; if (dh) (chars.Homer ||= { name: 'Homer', refs: [] }).refs.push(tile(resolve(dh.path, W), { id: dh.id, title: dh.title, role: clean(dh.role), notes: clean(dh.notes), approved: !!dh.approved, status: clean(dh.status), group: 'Dream look', view: 'dream look' }));
const characters = [...order.filter(k => chars[k]).map(k => chars[k]), ...Object.keys(chars).filter(k => !order.includes(k)).map(k => chars[k])];

// ---- SETS (locations, each with camera-angle tiles). Every set render in the reference packs is classified
// by folder + scene id + keywords into ONE set. Sets are places; anything moved/touched is a prop.
const env = sb.environmentReferences || {};
const listImgs = (dir, re, cap = 14) => { const d = W + '/' + dir; if (!fs.existsSync(d)) return []; return fs.readdirSync(d).filter(f => /.(png|jpe?g)$/i.test(f) && (!re || re.test(f))).map(f => d + '/' + f).filter(p => fs.statSync(p).isFile()).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs).slice(0, cap); };
const sceneSet = id => (SET[id] || [''])[0];
const SCAN = ['environment-reference-pack/s09-door-action','environment-reference-pack/garage-reveal-sequence','environment-reference-pack/garage-scenes-v3','environment-reference-pack/garage-scenes-v4','environment-reference-pack/garage-scenes-v5','environment-reference-pack/set-angles-v4','environment-reference-pack/shoulder-pass-v1','environment-reference-pack/scene-rebuild-v6','environment-reference-pack/scene-rebuild-v7','environment-reference-pack/driveway-sequence','environment-reference-pack/bugatti-dream-sequence','environment-reference-pack/bugatti-la-voiture-noire','environment-reference-pack/vintage-v2','waymo-review','opening-review','apu-arrival-review','worker-pch-empty-road-v1','closing-review','phone-reference-20260910','continuity-reference-pack','garage-lipsync-review','garage-through-apu-review/s24-reference-rebuild-v3'];
const classify = (dir, name) => {
  const f = name.toUpperCase(); if (/^(REXX|HOMER|APU|BART)[-_]/.test(f)) return null;  // character references are not set angles
  const m = f.match(/(?:^|[^A-Z0-9])(S[0-9]{2})(?:[^0-9]|$)/); if (m && sceneSet(m[1])) return sceneSet(m[1]);
  if (/VINTAGE|KWIK/.test(f) || /vintage/i.test(dir)) return 'Vintage Mart';
  if (/BUGATTI|PCH|EMPTY-ROAD|HIGHWAY/.test(f) || /bugatti|pch/i.test(dir)) return 'PCH road (dream)';
  if (/WAYMO/.test(f) || /waymo/i.test(dir)) return 'Waymo';
  if (/STAIR/.test(f)) return 'Stairs';
  if (/COFFEE|KITCHEN|COUNTER|PHONE/.test(f) || /phone-reference|opening/i.test(dir)) return 'Coffee';
  if (/BALCONY|DECK/.test(f)) return /UPPER|UPSTAIRS/.test(f) ? 'Upstairs balcony' : 'Outside balcony';
  if (/DRIVEWAY|WALKUP|WALK-UP/.test(f) || /driveway/i.test(dir)) return 'Driveway';
  if (/APU|FIREBIRD|PONTIAC|PASSENGER|FIST|CAR-/.test(f) || /apu-arrival|closing/i.test(dir)) return "Apu's car";
  if (/GARAGE|DOOR|RECLINER|TREADMILL|SHELF|SHOULDER|REVEAL|MASTER|HOT-WHEELS|SMITTY/.test(f) || /garage|s09-door|set-angles|shoulder/i.test(dir)) return 'Garage';
  return null;
};
const bySet = {}; const seenFile = new Set();
for (const dir of SCAN) { const d = W + '/' + dir; if (!fs.existsSync(d)) continue; for (const f of fs.readdirSync(d)) { if (!/[.](png|jpe?g)$/i.test(f) || /CONTACT|SHEET|CROP|AUDIT|QC|TILE|GRID|INSPECTION|REPAIRED/i.test(f)) continue; const p = d + '/' + f; if (!fs.statSync(p).isFile()) continue; const key = f.toLowerCase(); if (seenFile.has(key)) continue; const set = classify(dir, f); if (!set) continue; seenFile.add(key); (bySet[set] ||= []).push(p); } }
const gm = resolve(env.garageMaster, W); if (gm) (bySet['Garage'] ||= []).unshift(gm);
const SETS_ORDER = [['Stairs','Opening. Rexx comes down the stairs.'],['Coffee','Kitchen counter. Coffee, the phone call.'],['Outside balcony','Lower balcony.'],['Upstairs balcony','Upper deck.'],['Waymo','Boarding and the ride.'],['Driveway',"Homer's driveway, garage door, Apu's arrival."],['Garage','The garage: master set, reveal, recliner, treadmill. Closed or open, it is one set.'],['PCH road (dream)',"Homer's Bugatti dream on the empty PCH."],["Apu's car",'The Firebird: driver window, passenger seat, fist bump.'],['Vintage Mart','Former Kwik-E-Mart. Future episodes.'],['Road','Passenger-window travel, bus stop (future).']];
const CAP = 130;
const sets = SETS_ORDER.map(([name, blurb]) => { const imgs = [...new Set(bySet[name] || [])].sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs); return { name, blurb, total: imgs.length, angles: imgs.slice(0, CAP).map(p => tile(p, { id: path.basename(p).replace(/[.][^.]+$/, ''), title: path.basename(p).replace(/[.][^.]+$/, '').replace(/[-_]/g, ' ') })), scenes: scenes.filter(s => s.set === name).map(s => s.id) }; });

// ---- PROPS (things moved, touched, or moving)
const propTiles = [];
const addProp = (title, p, role, status, extra = {}) => { const f = resolve(p, W); propTiles.push(tile(f, { id: title, title, role: clean(role), status: clean(status), ...extra })); };
const bs = sb.characterReferences?.bartSlingshot; if (bs) addProp('Slingshot (Bart)', bs.path, bs.role, bs.status, { approved: !!bs.approved });
if (env.dreamVehicle) addProp('Bugatti La Voiture Noire (dream car)', env.dreamVehicle.path, env.dreamVehicle.role, env.dreamVehicle.status, { approved: !!env.dreamVehicle.approved });
for (const it of props.items || props.references || props.props || []) addProp(it.title || it.id || 'prop', it.path || it.file || it.image, it.role || it.notes || '', it.status || '', { approved: !!it.approved });
for (const f of listImgs('environment-reference-pack/real-prop-references', null, 20)) if (!propTiles.some(t => t.file === path.basename(f))) addProp(path.basename(f).replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '), f, '', '');
for (const name of ['phone', 'coffee mug', 'garage remote', 'boxes', 'consoles', 'Hot Wheels', 'treadmill', 'recliner', 'speakers', 'mosquito', 'skateboard', 'Firebird (car)', 'Happy Gas tank']) if (!propTiles.some(t => t.title.toLowerCase().includes(name.toLowerCase()))) propTiles.push({ id: name, title: name, role: 'used in ' + scenes.filter(s => s.props.includes(name)).map(s => s.id).join(', '), img: null, date: null, status: 'no reference image yet' });
if (env.boxedCollectibles) propTiles.push({ id: 'boxed-collectibles-rules', title: 'Boxed collectibles (rules)', role: clean(env.boxedCollectibles.consoles) + ' ' + clean(env.boxedCollectibles.figures) + ' ' + clean(env.boxedCollectibles.storageLabels), status: '', img: null, date: null });

const objects = [...sets.flatMap(st => st.angles.map(a => ({ title: st.name + ' · ' + a.title, role: 'set angle', status: '', img: a.img, date: a.date, approved: !!a.approved }))), ...propTiles.map(p => ({ title: p.title, role: p.role, status: p.status, img: p.img, date: p.date, approved: !!p.approved }))];
const board = { format: 2, objects, v74Date: V74_DATE, source: 'Codex scene-board/storyboard.json + continuity-reference-pack/reference-lock.json (VIEW build; never writes back)', builtAt: new Date().toISOString(), version: sb.version, currentCut: sb.currentFullCut?.title, scenes, characters, sets, props: propTiles, lockStatus: clean(lock.status), blockers: (lock.blockers || []).map(clean) };
fs.writeFileSync(EDITOR + '/board.json', JSON.stringify(board, null, 1));
fs.writeFileSync('projects/garage-dream/STORYBOARD-BOARD.json', JSON.stringify(board, null, 2));
const nS = scenes.reduce((s, x) => s + x.stills.length, 0), nA = sets.reduce((s, x) => s + x.angles.length, 0);
console.log(`board v2: ${scenes.length} scenes with ${nS} stills, ${characters.length} characters (${characters.reduce((s, c) => s + c.refs.length, 0)} refs), ${sets.length} sets (${nA} angles), ${propTiles.length} props, ${[...thumbs.values()].filter(Boolean).length} thumbs`);
