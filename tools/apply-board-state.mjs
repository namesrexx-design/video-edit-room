// apply-board-state.mjs — turn Rexx's choices on the storyboard page into real storyboard changes.
//
// The page saves what he does (remove, delete, reject, choose, add from library, move, remove a scene, edit a line)
// to BizBox (boardState). This writes those choices into projects/garage-dream/source/storyboard.json, so they hold
// for every agent and every rebuild. Idempotent: running it twice changes nothing the second time.
//
//   node tools/apply-board-state.mjs                 (reads https://app.biz-box.io/api/functions/boardState?page=garage-dream)
//   node tools/apply-board-state.mjs state.json      (reads a saved state file)
//
// What each choice becomes on the scene (build-board reads these):
//   ownerArchived[]      tile ids moved to the archive by the owner
//   ownerRejected[]      tile ids rejected / deleted by the owner — never shown again
//   ownerChosen[]        clip ids the owner picked for the scene   (also added to approvedClipIds)
//   ownerAddedClips[]    clip ids added from the library          (also added to approvedClipIds)
//   ownerAddedAudio[]    audio ids added from the library
//   ownerMovedIn[]       {id, from} tiles moved here from another scene
//   assembly.active      false when the owner removed the scene from the film
//   line                 the owner's edited line (previous kept in linePrevious)
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve('projects/garage-dream/source/storyboard.json');
const STATE_URL = 'https://app.biz-box.io/api/functions/boardState?page=garage-dream';

export async function loadState(arg) {
  if (arg) return JSON.parse(fs.readFileSync(arg, 'utf8'));
  const r = await fetch(STATE_URL); if (!r.ok) throw new Error('boardState HTTP ' + r.status);
  const j = await r.json(); return j.state || {};
}

const sceneOfKey = k => (String(k).match(/^scene:(S\d+[A-Z]?)/) || [])[1] || null;
const tileOfKey = k => { const i = String(k).indexOf('/'); return i < 0 ? null : String(k).slice(i + 1); };
const add = (arr, v) => { if (!arr.includes(v)) arr.push(v); return arr; };

export function applyState(sb, st) {
  const log = [];
  const byId = Object.fromEntries(sb.scenes.map(s => [s.id, s]));
  const touch = (s, k) => { s[k] = Array.isArray(s[k]) ? s[k] : []; return s[k]; };
  // archive / reject / delete
  for (const [list, field] of [[st.archived, 'ownerArchived'], [st.rejected, 'ownerRejected'], [st.deleted, 'ownerRejected']]) {
    for (const k of list || []) { const s = byId[sceneOfKey(k)], t = tileOfKey(k); if (!s || !t) continue;
      const arr = touch(s, field); if (!arr.includes(t)) { arr.push(t); log.push(`${s.id}: ${field === 'ownerRejected' ? 'rejected' : 'archived'} ${t}`); }
      if (/^INV\d+$/.test(t)) { s.approvedClipIds = (s.approvedClipIds || []).filter(x => x !== t); add(touch(s, 'archivedClipIds'), t); } } }
  // chosen clips
  for (const [key, val] of Object.entries(st.chosen || {})) { const s = byId[key.replace(/:.*$/, '')]; if (!s) continue;
    for (const id of (Array.isArray(val) ? val : [val])) { if (!touch(s, 'ownerChosen').includes(id)) { s.ownerChosen.push(id); log.push(`${s.id}: chose ${id}`); }
      add(touch(s, 'approvedClipIds'), id); s.archivedClipIds = (s.archivedClipIds || []).filter(x => x !== id); s.ownerArchived = (s.ownerArchived || []).filter(x => x !== id); } }
  // added from the library
  for (const [sid, items] of Object.entries(st.added || {})) { const s = byId[sid]; if (!s) continue;
    for (const it of items || []) { const field = it.type === 'audio' ? 'ownerAddedAudio' : 'ownerAddedClips';
      if (!touch(s, field).includes(it.id)) { s[field].push(it.id); log.push(`${s.id}: added ${it.type} ${it.id}`); }
      if (it.type !== 'audio') add(touch(s, 'approvedClipIds'), it.id); } }
  // moved tiles
  for (const [k, to] of Object.entries(st.moved || {})) { const from = byId[sceneOfKey(k)], dest = byId[to], t = tileOfKey(k); if (!from || !dest || !t || from === dest) continue;
    if (!touch(from, 'ownerArchived').includes(t)) from.ownerArchived.push(t);
    if (!touch(dest, 'ownerMovedIn').some(m => m.id === t)) { dest.ownerMovedIn.push({ id: t, from: from.id }); log.push(`moved ${t}: ${from.id} → ${dest.id}`); }
    if (/^INV\d+$/.test(t)) { add(touch(dest, 'ownerAddedClips'), t); add(touch(dest, 'approvedClipIds'), t); } }
  // scenes removed / put back
  const removed = new Set(st.sceneRemoved || []);
  for (const s of sb.scenes) {
    const byOwnerPage = s.assembly?.reason?.startsWith('Removed on the storyboard page');
    if (removed.has(s.id) && s.assembly?.active !== false) { s.assembly = { active: false, archivedAt: new Date().toISOString().slice(0, 10), reason: 'Removed on the storyboard page by the owner.' }; log.push(`${s.id}: removed from the film`); }
    if (!removed.has(s.id) && byOwnerPage) { s.assembly = { ...s.assembly, active: true, restoredAt: new Date().toISOString().slice(0, 10) }; log.push(`${s.id}: put back in the film`); }
  }
  // edited lines
  for (const [sid, text] of Object.entries(st.scripts || {})) { const s = byId[sid]; if (!s || typeof text !== 'string' || !text.trim() || s.line === text) continue;
    s.linePrevious = [...(s.linePrevious || []), s.line]; s.line = text; log.push(`${s.id}: line edited`); }
  return log;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
  const st = await loadState(process.argv[2]);
  const sb = JSON.parse(fs.readFileSync(SRC, 'utf8'));
  const log = applyState(sb, st);
  if (log.length) { fs.writeFileSync(SRC, JSON.stringify(sb, null, 2) + '\n'); }
  console.log(log.length ? log.join('\n') : 'nothing new to apply');
}
