// LYFE scheduler — our own posting queue, on our own server.
//
// Rexx, 2026-09-17: "we build our own schedule on our server."
//
// It runs in two modes, per platform, and that is the whole point:
//   • API mode — we are approved for that platform's posting API, so it posts itself.
//   • HANDOFF mode — we are not (yet), so at the scheduled minute the post becomes "ready":
//     the caption is waiting, the file is downloadable, and Rexx posts it in one motion.
// Same queue, same calendar, same approvals. Platforms move from handoff to API as approvals land,
// and nothing about the plan changes when they do.
//
// 🔴 Two rules that do not bend:
//   1. Nothing is posted that was not approved first.
//   2. No account passwords live here. API mode uses tokens the platform issues, in .env, never in git.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, createReadStream } from 'node:fs';
import { join, resolve, extname } from 'node:path';
import { load, save, addPost, setStatus, due, PLATFORMS, dbFile, mediaRoot } from './store.mjs';
import { dispatch, ADAPTER_PLATFORMS } from './dispatch.mjs';
import { enabled as tgEnabled, notifyReady, pollButtons } from './telegram.mjs';

const PORT = Number(process.env.SCHEDULER_PORT || 8791);
const KEY = process.env.SCHEDULER_KEY || '';           // required for anything that changes state
const HERE = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

// Which platforms can post themselves today. Empty on purpose: every platform below needs its own
// app review before it will accept an automated post, so today every one is a handoff.
const API_READY = (process.env.SCHEDULER_API_PLATFORMS || '').split(',').map((s) => s.trim()).filter(Boolean);

const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body, null, 2)); };
const readBody = (req) => new Promise((ok, no) => { let s = ''; req.on('data', (d) => { s += d; if (s.length > 2e6) req.destroy(); }); req.on('end', () => { try { ok(s ? JSON.parse(s) : {}); } catch (e) { no(e); } }); });
const authed = (req) => !KEY || req.headers['x-scheduler-key'] === KEY;

/** Move every due post forward. API platforms post; the rest become "ready" for a human. */
function tick() {
  const db = load();
  const list = due(db);
  const toDispatch = []; const toNotify = [];
  for (const p of list) {
    if (API_READY.includes(p.platform) && ADAPTER_PLATFORMS.includes(p.platform)) {
      toDispatch.push(p);   // run AFTER this tick's save, so its stale copy cannot undo the claim
    } else if (API_READY.includes(p.platform)) {
      setStatus(db, p.id, 'ready', { note: `no adapter built for ${p.platform} yet` });
    } else {
      setStatus(db, p.id, 'ready', { mode: 'handoff' });
      toNotify.push({ ...p, status: 'ready' });
    }
  }
  if (list.length) save(db);
  if (toNotify.length && tgEnabled()) notifyReady(toNotify).catch((e) => console.error(`[scheduler] telegram: ${e.message}`));
  for (const p of toDispatch) dispatch(p).catch((e) => console.error(`[scheduler] dispatch ${p.id} failed: ${e.message}`));
  return list.length;
}

const page = () => {
  const db = load();
  const fmt = (p) => `<tr class="s-${p.status}">
    <td>${p.scheduled_at ? new Date(p.scheduled_at).toISOString().replace('T', ' ').slice(0, 16) : '—'}</td>
    <td><b>${esc(p.platform)}</b></td>
    <td>${esc(p.title)}</td>
    <td class="cap">${esc(p.caption).slice(0, 160)}</td>
    <td>${p.asset ? `<a href="/file?p=${encodeURIComponent(p.asset)}">download</a>` : '—'}</td>
    <td>${p.status}</td>
    <td>${p.status === 'draft' ? btn(p.id, 'approved', 'Approve') : ''}${p.status === 'ready' ? btn(p.id, 'posted', 'Mark posted') + btn(p.id, 'skipped', 'Skip') : ''}</td>
  </tr>`;
  const btn = (id, to, label) => `<button onclick="mv('${id}','${to}')">${label}</button>`;
  const rows = [...db.posts].sort((a, b) => String(a.scheduled_at).localeCompare(String(b.scheduled_at))).map(fmt).join('');
  return `<!doctype html><meta charset="utf-8"><title>LYFE scheduler</title>
<style>
:root{color-scheme:dark}body{margin:0;background:#04262b;color:#f6f1e7;font:14px/1.5 system-ui,Segoe UI,sans-serif}
header{padding:18px 20px;border-bottom:1px solid rgba(246,241,231,.14)}
h1{font:600 22px Georgia,serif;margin:0 0 4px}p{margin:0;color:#a8bcbe}
table{width:100%;border-collapse:collapse}td,th{padding:8px 10px;border-bottom:1px solid rgba(246,241,231,.1);text-align:left;vertical-align:top}
th{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#a8bcbe}
.cap{color:#a8bcbe;max-width:38ch}
button{background:#f6f1e7;color:#04262b;border:0;border-radius:999px;padding:5px 12px;font-weight:600;cursor:pointer;margin-right:6px}
tr.s-ready td{background:rgba(255,194,28,.10)}tr.s-posted td{opacity:.55}
a{color:#7fd4da}
</style>
<header><h1>LYFE scheduler</h1><p>${db.posts.length} posts · approve first, then it goes out at its time. Ready means it is your turn.</p></header>
<table><thead><tr><th>When (UTC)</th><th>Where</th><th>What</th><th>Caption</th><th>File</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table>
<script>
async function mv(id,to){const k=localStorage.getItem('k')||prompt('scheduler key');localStorage.setItem('k',k);
 await fetch('/posts/'+id,{method:'PATCH',headers:{'content-type':'application/json','x-scheduler-key':k},body:JSON.stringify({status:to})});location.reload();}
</script>`;
};
const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');

const server = createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const p = u.pathname.replace(/^\/scheduler/, '') || '/';
  try {
    if (req.method === 'GET' && (p === '/' || p === '/index.html')) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(page()); }
    if (req.method === 'GET' && p === '/health') return json(res, 200, { ok: true, db: dbFile, posts: load().posts.length, api_platforms: API_READY });
    if (req.method === 'GET' && p === '/posts') return json(res, 200, load().posts);
    if (req.method === 'GET' && p === '/due') return json(res, 200, due(load()));

    // the file behind a post, so "ready" means the video is one click away
    if (req.method === 'GET' && p === '/file') {
      const want = resolve(mediaRoot, '.' + resolve('/', u.searchParams.get('p') || ''));
      if (!want.startsWith(resolve(mediaRoot)) || !existsSync(want) || !statSync(want).isFile()) return json(res, 404, { error: 'not found' });
      res.writeHead(200, { 'content-type': extname(want) === '.mp4' ? 'video/mp4' : 'application/octet-stream', 'content-disposition': `attachment; filename="${want.split(/[\\/]/).pop()}"` });
      return createReadStream(want).pipe(res);
    }

    if (!authed(req)) return json(res, 401, { error: 'x-scheduler-key required' });

    if (req.method === 'POST' && p === '/posts') {
      const b = await readBody(req); const db = load();
      const made = (Array.isArray(b) ? b : [b]).map((one) => addPost(db, one));
      save(db); return json(res, 201, made);
    }
    if (req.method === 'PATCH' && /^\/posts\/[\w-]+$/.test(p)) {
      const id = p.split('/').pop(); const b = await readBody(req); const db = load();
      const post = setStatus(db, id, b.status, b.result); save(db); return json(res, 200, post);
    }
    if (req.method === 'POST' && p === '/tick') return json(res, 200, { moved: tick() });

    // Load a post-plan.json straight out of the film repo: one entry becomes one post per platform.
    if (req.method === 'POST' && p === '/import') {
      const b = await readBody(req);
      const file = b.file || '/repo/projects/garage-dream/content/post-plan.json';
      if (!existsSync(file)) return json(res, 404, { error: `no ${file}` });
      const plan = JSON.parse(readFileSync(file, 'utf8'));
      const db = load(); const made = [];
      for (const item of plan) {
        for (const platform of (item.platforms || [])) {
          made.push(addPost(db, {
            title: item.id || item.title, platform, asset: item.asset, aspect: item.aspect,
            caption: (item.captions && (item.captions[platform] || item.captions.default)) || '',
            first_comment: item.first_comment, group: item.id, source: file, scheduled_at: null,
          }));
        }
      }
      save(db); return json(res, 201, { imported: made.length });
    }
    return json(res, 404, { error: 'no such route' });
  } catch (e) { return json(res, 400, { error: String(e.message || e) }); }
});

setInterval(tick, 60_000).unref?.();
if (tgEnabled()) setInterval(() => pollButtons().catch(() => {}), 4_000).unref?.();   // "Posted" / "Skip" buttons
server.listen(PORT, () => console.log(`[scheduler] on :${PORT} · db ${dbFile} · api platforms: ${API_READY.join(',') || 'none (everything is a handoff)'}`));
