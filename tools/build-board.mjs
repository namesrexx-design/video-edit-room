// Build the STORYBOARD data + thumbnails for LYFE Studio from Codex's storyboard.json,
// reference-lock.json (characters) and the real-prop manifest (objects). Output: board.json + sb/*.jpg
//   node tools/build-board.mjs
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const W = 'C:/Users/16263/Documents/Codex/2026-09-04/referenced-chatgpt-conversation-this-is-an-2';
const EDITOR = 'C:/Users/16263/AppData/Local/Temp/claude/C--Users-16263-Desktop-Claude-Code-Build/9d00f0c5-975e-4197-b36d-8f1eb6052b13/scratchpad/film/editor';
fs.mkdirSync(EDITOR + '/sb', { recursive: true });
const sb = JSON.parse(fs.readFileSync(W + '/scene-board/storyboard.json', 'utf8'));
const lock = JSON.parse(fs.readFileSync(W + '/continuity-reference-pack/reference-lock.json', 'utf8'));
let props = { items: [] }; try { props = JSON.parse(fs.readFileSync(W + '/environment-reference-pack/real-prop-references/manifest.json', 'utf8')); } catch (e) {}

const resolve = (p, base) => { if (!p) return null; for (const b of [base, W + '/scene-board', W]) { const f = path.resolve(b, p); if (fs.existsSync(f)) return f; } return null; };
let n = 0; const thumbs = new Map();
function thumb(src) {
  if (!src) return null; if (thumbs.has(src)) return thumbs.get(src);
  const id = 'sb' + String(++n).padStart(3, '0') + '.jpg'; const dest = `${EDITOR}/sb/${id}`;
  if (!fs.existsSync(dest)) { const r = spawnSync('ffmpeg', ['-v', 'error', '-nostdin', '-n', '-i', src, '-frames:v', '1', '-vf', "scale='min(720,iw)':-2", '-q:v', '5', dest], { stdio: 'pipe' }); if (r.status !== 0) { thumbs.set(src, null); return null; } }
  thumbs.set(src, 'sb/' + id); return 'sb/' + id;
}
const clean = s => (s || '').replace(/\s+/g, ' ').trim();

// scenes
const scenes = sb.scenes.map(s => ({ id: s.id, title: s.title, line: clean(s.line), status: clean(s.status), still: thumb(resolve(s.image, W + '/scene-board')), v74: s.v74?.episodeSeconds ? { start: s.v74.episodeSeconds[0], end: s.v74.episodeSeconds[1] } : (s.v74?.inCut === false ? { inCut: false, note: s.v74.note } : null), phase: s.episode || '' }));

// characters: reference-lock items grouped by character + continuity notes + voices
const chars = {}; const order = ['Rexx', 'Homer', 'Apu', 'Bart'];
for (const g of lock.groups || []) for (const it of g.items || []) { const c = it.character || 'Other'; (chars[c] ||= { name: c, refs: [] }); chars[c].refs.push({ id: it.id, title: it.title, role: clean(it.role), notes: clean(it.notes), approved: !!it.approved, status: clean(it.status), group: g.title, img: thumb(resolve(it.path, W)) }); }
for (const [name, c] of Object.entries(sb.characterContinuity || {})) { (chars[name] ||= { name, refs: [] }); chars[name].continuity = Object.fromEntries(Object.entries(c).filter(([k, v]) => typeof v === 'string').map(([k, v]) => [k, clean(v)])); }
for (const [name, v] of Object.entries(sb.characterReferences?.voiceProfiles || {})) { (chars[name] ||= { name, refs: [] }); chars[name].voice = { voiceName: v.voiceName, voiceId: v.voiceId, model: v.model, status: clean(v.status) }; }
for (const c of sb.characterReferences?.characters || []) { const k = c.name; (chars[k] ||= { name: k, refs: [] }); chars[k].status = clean(c.status); }
const dh = sb.characterReferences?.dreamHomer; if (dh) (chars.Homer ||= { name: 'Homer', refs: [] }).refs.push({ id: dh.id, title: dh.title, role: clean(dh.role), notes: clean(dh.notes), approved: !!dh.approved, status: clean(dh.status), group: 'Dream look', img: thumb(resolve(dh.path, W)) });
const characters = [...order.filter(k => chars[k]).map(k => chars[k]), ...Object.keys(chars).filter(k => !order.includes(k)).map(k => chars[k])];

// sets & objects
const env = sb.environmentReferences || {}; const objects = [];
const addObj = (title, p, role, status, extra = {}) => { const f = resolve(p, W); objects.push({ title, role: clean(role), status: clean(status), img: thumb(f), ...extra }); };
addObj('Garage master set', env.garageMaster, 'The garage as approved: shelves, boxes, consoles, treadmill, recliner', env.status);
if (env.vintageMart) addObj('Vintage Mart storefront', env.vintageMart.exterior, 'Former Kwik-E-Mart renamed Vintage Mart; future episodes', env.vintageMart.status);
if (env.dreamVehicle) addObj(env.dreamVehicle.title, env.dreamVehicle.path, env.dreamVehicle.role, env.dreamVehicle.status, { approved: !!env.dreamVehicle.approved });
const bs = sb.characterReferences?.bartSlingshot; if (bs) addObj(bs.title, bs.path, bs.role, bs.status, { approved: !!bs.approved });
for (const it of props.items || props.references || []) addObj(it.title || it.id || 'prop', it.path || it.file, it.role || it.notes || '', it.status || '', { approved: !!it.approved });
if (env.boxedCollectibles) objects.push({ title: 'Boxed collectibles (rules)', role: clean(env.boxedCollectibles.consoles) + ' ' + clean(env.boxedCollectibles.figures) + ' ' + clean(env.boxedCollectibles.storageLabels), status: '', img: null });

const board = { source: 'Codex scene-board/storyboard.json + continuity-reference-pack/reference-lock.json', builtAt: new Date().toISOString(), version: sb.version, currentCut: sb.currentFullCut?.title, scenes, characters, objects, lockStatus: clean(lock.status), blockers: (lock.blockers || []).map(clean) };
fs.writeFileSync(EDITOR + '/board.json', JSON.stringify(board, null, 1));
fs.writeFileSync('projects/garage-dream/STORYBOARD-BOARD.json', JSON.stringify(board, null, 2));
console.log(`board: ${scenes.length} scenes, ${characters.length} characters (${characters.reduce((s, c) => s + c.refs.length, 0)} refs), ${objects.length} objects, ${[...thumbs.values()].filter(Boolean).length} thumbs`);
