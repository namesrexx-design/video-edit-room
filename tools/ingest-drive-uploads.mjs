// ingest-drive-uploads.mjs — file what Rexx drops into the Drive folders into the storyboard.
//
//   node tools/ingest-drive-uploads.mjs            (dry run)
//   node tools/ingest-drive-uploads.mjs --write    (copy to D:, register, then run build-board)
//
// The owner adds photos from his phone (Google Drive app) into:
//   EDIT_ROOM/LYFE_STUDIO_BOARD/09_CHARACTERS__HOMER_APU_BART/<NAME>/CURRENT   (or a new <NAME> folder)
//   EDIT_ROOM/LYFE_STUDIO_BOARD/10_SETS__LOCATIONS_AND_ANGLES/<SET>/CURRENT     (or a new <SET> folder)
//   EDIT_ROOM/LYFE_STUDIO_BOARD/11_PROPS__MOVED_TOUCHED_MOVING/CURRENT
//   EDIT_ROOM/LYFE_STUDIO_BOARD/08_…/LIVE_SCENES/<SXX__…>/01_STILLS_AND_REFERENCES
//   EDIT_ROOM/INCOMING_FROM_REXX/<anything>                                       (unsorted; goes to the inbox list)
// Anything there that the fill tool did not write (its files carry the NAME__ROLE__ / NN__SET__ / SXX__ROLE__ prefixes)
// is a new upload. It is COPIED (never moved) to D:/REXX/AI_Video/BizBox-Garage-Dream/owner-uploads/<kind>/<name>/<date>/
// and registered as a CANDIDATE:
//   character → continuity-reference-pack/reference-lock.json, group "owner-uploads" (approved:false)
//   set / prop → the owner-uploads folder is scanned by build-board (sets by folder name; props under props/)
//   scene      → scene-board/storyboard.json → that scene's pendingFrames
// Approval stays with the owner (tap the tile → approve / Edit / What's wrong). Backups of both JSON files are written first.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const WRITE = process.argv.includes('--write');
const DRIVE = 'G:/My Drive/00_PROJECTS/AUTOPILOT/Video 04 - Garage Dream - IN PRODUCTION';
const BOARD = `${DRIVE}/EDIT_ROOM/LYFE_STUDIO_BOARD`;
const CODEX = 'C:/Users/16263/Documents/Codex/2026-09-04/referenced-chatgpt-conversation-this-is-an-2';
const MEDIA = 'D:/REXX/AI_Video/BizBox-Garage-Dream';
const OUT = `${MEDIA}/owner-uploads`;
const IMG = /[.](png|jpe?g|webp|heic)$/i, VID = /[.](mp4|mov)$/i;
const today = new Date().toISOString().slice(0, 10);
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const isToolFile = (f) => /^(S[0-9]+[AB]?__[A-Z-]+__|[0-9]{2}__|.+__(APPROVED|ARCHIVED)__)/.test(f) || f.startsWith('00_');
const list = (d) => fs.existsSync(d) ? fs.readdirSync(d).filter((f) => fs.statSync(path.join(d, f)).isFile() && (IMG.test(f) || VID.test(f)) && !isToolFile(f)) : [];
const dirs = (d) => fs.existsSync(d) ? fs.readdirSync(d).filter((f) => fs.statSync(path.join(d, f)).isDirectory()) : [];
const cap = (s) => s.replace(/_/g, ' ').toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

const found = []; // { kind, name, sceneId?, src, file }
for (const n of dirs(`${BOARD}/09_CHARACTERS__HOMER_APU_BART`)) for (const sub of ['CURRENT', '']) for (const f of list(path.join(`${BOARD}/09_CHARACTERS__HOMER_APU_BART`, n, sub))) found.push({ kind: 'character', name: cap(n), src: path.join(`${BOARD}/09_CHARACTERS__HOMER_APU_BART`, n, sub, f), file: f });
for (const n of dirs(`${BOARD}/10_SETS__LOCATIONS_AND_ANGLES`)) for (const sub of ['CURRENT', '']) for (const f of list(path.join(`${BOARD}/10_SETS__LOCATIONS_AND_ANGLES`, n, sub))) found.push({ kind: 'set', name: cap(n), src: path.join(`${BOARD}/10_SETS__LOCATIONS_AND_ANGLES`, n, sub, f), file: f });
for (const sub of ['CURRENT', '']) for (const f of list(path.join(`${BOARD}/11_PROPS__MOVED_TOUCHED_MOVING`, sub))) found.push({ kind: 'prop', name: f.replace(/[.][^.]+$/, ''), src: path.join(`${BOARD}/11_PROPS__MOVED_TOUCHED_MOVING`, sub, f), file: f });
const SCENES = `${BOARD}/08_LYFE_STUDIO_SCENES__GARAGE_DREAM_EPISODE/LIVE_SCENES`;
for (const d of dirs(SCENES)) { const id = d.split('__')[0]; for (const f of list(path.join(SCENES, d, '01_STILLS_AND_REFERENCES'))) found.push({ kind: 'scene', name: d, sceneId: id, src: path.join(SCENES, d, '01_STILLS_AND_REFERENCES', f), file: f }); }
for (const d of dirs(`${DRIVE}/EDIT_ROOM/INCOMING_FROM_REXX`)) for (const f of list(path.join(`${DRIVE}/EDIT_ROOM/INCOMING_FROM_REXX`, d))) if (!/rexx-upload/.test(f)) found.push({ kind: 'inbox', name: d, src: path.join(`${DRIVE}/EDIT_ROOM/INCOMING_FROM_REXX`, d, f), file: f });

// already ingested? the copy on D: exists
const dest = (u) => `${OUT}/${u.kind}s/${(u.name || 'inbox').replace(/[^A-Za-z0-9' ()-]+/g, '_')}/${today}/${u.file}`;
const fresh = found.filter((u) => !fs.existsSync(dest(u)) && !fs.existsSync(dest(u).replace(`/${today}/`, '/')) && !alreadyOnD(u));
function alreadyOnD(u) { const base = `${OUT}/${u.kind}s`; if (!fs.existsSync(base)) return false; const walk = (d) => fs.readdirSync(d).some((f) => { const p = path.join(d, f); return fs.statSync(p).isDirectory() ? walk(p) : f === u.file && fs.statSync(p).size === fs.statSync(u.src).size; }); return walk(base); }

console.log(`${found.length} owner files in the Drive folders, ${fresh.length} new`);
for (const u of fresh) console.log(`  ${u.kind.padEnd(9)} ${(u.sceneId || u.name).padEnd(28)} ${u.file}`);
if (!WRITE || !fresh.length) process.exit(0);

// copy + register
const lockP = `${CODEX}/continuity-reference-pack/reference-lock.json`, sbP = `${CODEX}/scene-board/storyboard.json`;
const lock = JSON.parse(fs.readFileSync(lockP, 'utf8')), sb = JSON.parse(fs.readFileSync(sbP, 'utf8'));
fs.mkdirSync(`${CODEX}/reference-update-backups/owner-uploads-${stamp}`, { recursive: true });
fs.copyFileSync(lockP, `${CODEX}/reference-update-backups/owner-uploads-${stamp}/reference-lock.json`); fs.copyFileSync(sbP, `${CODEX}/reference-update-backups/owner-uploads-${stamp}/storyboard.json`);
let group = (lock.groups ||= []).find((g) => g.id === 'owner-uploads'); if (!group) { group = { id: 'owner-uploads', name: 'Owner uploads (candidates until approved)', items: [] }; lock.groups.push(group); }
const rel = (abs) => path.relative(CODEX, abs).replace(/\\/g, '/');
let registered = 0;
for (const u of fresh) {
  const d = dest(u); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(u.src, d, fs.constants.COPYFILE_EXCL);
  const id = `UP-${u.kind.toUpperCase()}-${today.replace(/-/g, '')}-${path.basename(u.file, path.extname(u.file)).replace(/[^A-Za-z0-9]+/g, '-').toUpperCase().slice(0, 40)}`;
  if (u.kind === 'character') { group.items.push({ id, path: d, character: u.name, title: `${u.name} · owner upload ${today}`, role: 'candidate reference uploaded by the owner', approved: false, gallerySelected: false, renderEligible: false, status: 'Owner upload — awaiting owner approval on the board', date: today }); registered++; }
  else if (u.kind === 'scene') { const sc = sb.scenes.find((x) => x.id === u.sceneId); if (sc) { (sc.pendingFrames ||= []).push({ id, image: path.relative(`${CODEX}/scene-board`, d).replace(/\\/g, '/'), title: `Owner upload · ${u.file}`, role: 'candidate', caption: `Uploaded by Rexx ${today} via Drive folder ${u.name}/01_STILLS_AND_REFERENCES`, status: 'Owner upload — awaiting approval', renderEligible: false }); registered++; } }
  // sets and props: build-board scans owner-uploads/sets/<Set>/… and owner-uploads/props/… by folder; nothing to write here
  else registered++;
}
fs.writeFileSync(lockP, JSON.stringify(lock, null, 2) + '\n');
fs.writeFileSync(sbP, JSON.stringify(sb, null, 2) + '\n');
fs.writeFileSync(`${CODEX}/scene-board/board-data.js`, 'window.REXX_BOARD = ' + JSON.stringify(sb) + ';\n');
console.log(`copied + registered ${registered}; rebuilding the board…`);
execSync('node tools/build-board.mjs', { stdio: 'inherit' });
fs.writeFileSync(`${DRIVE}/EDIT_ROOM/LYFE_STUDIO_BOARD/00_INGEST-RECEIPT-${stamp}.json`, JSON.stringify({ at: new Date().toISOString(), ingested: fresh.map((u) => ({ kind: u.kind, name: u.sceneId || u.name, file: u.file, copiedTo: dest(u) })) }, null, 2));
