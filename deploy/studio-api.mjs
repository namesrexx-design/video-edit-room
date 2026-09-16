// studio-api.mjs — the buttons behind the storyboard page on the shared server.
//
// Runs inside the `studio` container (port 8787), reached through Caddy at /api/* (same password as the page).
// No dependencies. One job at a time; every job writes a log you can watch from the page.
//
//   GET  /api/health                  → {ok, busy, film}
//   GET  /api/jobs                    → recent jobs
//   GET  /api/jobs/:id                → one job + its log
//   POST /api/apply                   → apply the owner's page choices to the storyboard source, rebuild, commit
//   POST /api/rebuild                 → rebuild the board
//   POST /api/render   {cut?}         → render the film (default cut STORYBOARD-FINAL), slice scenes, rebuild, copy to R2
//   POST /api/cut      {name, cut}    → save a Cut Room cut into the repo and commit
//   POST /api/upload?scene=S27&name=x.mp4   (raw body) → save to media, register on the scene, rebuild, copy to R2
//   POST /api/pull                    → git pull (bring in agents' pushes), rebuild
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

const REPO = process.env.LYFE_REPO || '/repo';
const MEDIA = process.env.LYFE_MEDIA_ROOT || '/data/media';
const EDITOR = process.env.LYFE_EDITOR_DIR || '/data/editor';
const BUCKET = 'r2:' + (process.env.R2_BUCKET || 'lyfe-studio');
const PORT = Number(process.env.STUDIO_API_PORT || 8787);
const JOBS = path.join(EDITOR, 'jobs');
fs.mkdirSync(JOBS, { recursive: true }); fs.mkdirSync(path.join(EDITOR, 'films'), { recursive: true }); fs.mkdirSync(path.join(EDITOR, 'scenes'), { recursive: true });

const jobs = [];          // newest first
let running = null; const queue = [];
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

function sh(job, cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    fs.appendFileSync(job.log, `\n$ ${cmd} ${args.join(' ')}\n`);
    const p = spawn(cmd, args, { cwd: REPO, env: process.env, ...opts });
    p.stdout.on('data', d => fs.appendFileSync(job.log, d)); p.stderr.on('data', d => fs.appendFileSync(job.log, d));
    p.on('close', code => code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`)));
  });
}
const git = (job, ...a) => sh(job, 'git', a);
// files the builders regenerate: never let them block a pull (the next build recreates them)
const GENERATED = ['projects/garage-dream/STORYBOARD-BOARD.json', 'cut-room/board.json'];
const pull = async (job) => { await git(job, 'checkout', '--', ...GENERATED).catch(() => {}); await pull(job); };
async function commit(job, msg, paths) {
  await git(job, 'add', ...paths);
  const st = await new Promise(r => { const p = spawn('git', ['diff', '--cached', '--quiet'], { cwd: REPO }); p.on('close', c => r(c)); });
  if (st === 0) { fs.appendFileSync(job.log, '\n(nothing to commit)\n'); return; }
  await git(job, '-c', 'user.name=LYFE Studio server', '-c', 'user.email=noreply@biz-box.io', 'commit', '-q', '-m', msg);
  try { await git(job, 'pull', '-q', '--rebase', '--autostash', 'origin', 'main'); } catch { fs.appendFileSync(job.log, '\n(pull before push failed; pushing anyway)\n'); }
  await git(job, 'push', '-q', 'origin', 'HEAD:main');
}
const publishBoard = async (job) => {
  // the page on this server reads board.json + sheets from the editor folder
  await sh(job, 'node', ['tools/build-board.mjs']);
  fs.copyFileSync(path.join(EDITOR, 'board.json'), path.join(REPO, 'cut-room/board.json'));
};

const RECIPES = {
  async pull(job) { await pull(job); await publishBoard(job); },
  async rebuild(job) { await publishBoard(job); },
  async apply(job) {
    await pull(job);
    await sh(job, 'node', ['tools/apply-board-state.mjs']);
    await publishBoard(job);
    await commit(job, 'Storyboard: apply the owner\'s page choices (studio server)', ['projects/garage-dream/source/storyboard.json', ...GENERATED]);
  },
  async cut(job) {
    const { name, cut } = job.input; const safe = String(name || 'CUT').replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 60);
    const f = path.join(REPO, 'projects/garage-dream/cuts', safe.endsWith('.json') ? safe : safe + '.json');
    fs.writeFileSync(f, JSON.stringify(cut, null, 1)); fs.appendFileSync(job.log, `saved ${f}\n`);
    await commit(job, `Cut Room: save ${path.basename(f)} (studio server)`, [path.relative(REPO, f)]);
    job.result = { file: path.relative(REPO, f) };
  },
  async render(job) {
    const cutRel = job.input.cut || 'projects/garage-dream/cuts/STORYBOARD-FINAL.json';
    const name = 'FILM-' + stamp();
    await pull(job).catch(() => {});
    await sh(job, 'node', ['tools/render-cut.mjs', cutRel, name]);
    const out = path.join(REPO, 'projects/garage-dream/renders', name + '.mp4');
    const film = path.join(EDITOR, 'films', 'GARAGE-DREAM-' + name + '.mp4'); fs.copyFileSync(out, film);
    await sh(job, 'node', ['tools/slice-scenes.mjs', cutRel, film, path.join(EDITOR, 'scenes')]);
    await publishBoard(job);
    await sh(job, 'rclone', ['copy', path.join(EDITOR, 'films'), BUCKET + '/editor/films', '--stats-one-line']);
    await commit(job, `Render ${name} (studio server): receipt + timeline`, ['projects/garage-dream/renders/RECEIPTS', 'projects/garage-dream/timelines', ...GENERATED]);
    job.result = { film: '/editor/films/' + path.basename(film) };
  },
  async upload(job) {
    const { scene, name, tmp } = job.input; const day = new Date().toISOString().slice(0, 10);
    const dir = path.join(MEDIA, 'owner-uploads', scene, day); fs.mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, name); fs.renameSync(tmp, dest);
    await sh(job, 'node', ['tools/register-upload.mjs', scene, dest]);
    await publishBoard(job);
    await sh(job, 'rclone', ['copy', dir, `${BUCKET}/media/owner-uploads/${scene}/${day}`, '--stats-one-line']);
    await commit(job, `Upload ${name} to ${scene} (studio server)`, ['projects/garage-dream/source/storyboard.json', 'projects/garage-dream/INVENTORY-MANIFEST.json', 'projects/garage-dream/AUDIO-MANIFEST.json', ...GENERATED]);
    job.result = { file: dest };
  },
};

function enqueue(kind, input = {}) {
  const id = stamp() + '-' + kind + '-' + crypto.randomBytes(2).toString('hex');
  const job = { id, kind, input, state: 'queued', at: new Date().toISOString(), log: path.join(JOBS, id + '.log') };
  fs.writeFileSync(job.log, `${kind} queued ${job.at}\n`);
  jobs.unshift(job); if (jobs.length > 50) jobs.pop(); queue.push(job); pump(); return job;
}
async function pump() {
  if (running || !queue.length) return;
  running = queue.shift(); running.state = 'running'; running.startedAt = new Date().toISOString();
  try { await RECIPES[running.kind](running); running.state = 'done'; }
  catch (e) { running.state = 'failed'; running.error = String(e.message || e); fs.appendFileSync(running.log, `\nFAILED: ${running.error}\n`); }
  running.endedAt = new Date().toISOString(); running = null; pump();
}

const view = j => ({ id: j.id, kind: j.kind, state: j.state, at: j.at, startedAt: j.startedAt, endedAt: j.endedAt, error: j.error, result: j.result });
const send = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
const readJson = req => new Promise((ok, bad) => { let d = ''; req.on('data', c => { d += c; if (d.length > 5e6) req.destroy(); }); req.on('end', () => { try { ok(d ? JSON.parse(d) : {}); } catch (e) { bad(e); } }); });

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'); const p = u.pathname.replace(/^\/api/, '');
  try {
    if (req.method === 'GET' && p === '/health') {
      const films = fs.readdirSync(path.join(EDITOR, 'films')).filter(f => f.endsWith('.mp4')).sort().reverse();
      return send(res, 200, { ok: true, busy: running ? view(running) : null, queued: queue.length, film: films[0] ? '/editor/films/' + films[0] : null });
    }
    if (req.method === 'GET' && p === '/jobs') return send(res, 200, jobs.map(view));
    if (req.method === 'GET' && p.startsWith('/jobs/')) {
      const j = jobs.find(x => x.id === p.slice(6)); if (!j) return send(res, 404, { error: 'no such job' });
      const log = fs.readFileSync(j.log, 'utf8'); return send(res, 200, { ...view(j), log: log.slice(-6000) });
    }
    if (req.method === 'POST' && ['/apply', '/rebuild', '/pull'].includes(p)) return send(res, 202, view(enqueue(p.slice(1))));
    if (req.method === 'POST' && p === '/render') { const b = await readJson(req); const cut = b.cut && /^projects\/garage-dream\/cuts\/[A-Za-z0-9._-]+\.json$/.test(b.cut) ? b.cut : undefined; return send(res, 202, view(enqueue('render', { cut }))); }
    if (req.method === 'POST' && p === '/cut') { const b = await readJson(req); if (!b.cut || b.cut.format !== 2) return send(res, 400, { error: 'expected a format-2 cut' }); return send(res, 202, view(enqueue('cut', { name: b.name, cut: b.cut }))); }
    if (req.method === 'POST' && p === '/upload') {
      const scene = u.searchParams.get('scene') || ''; const name = (u.searchParams.get('name') || '').replace(/[^A-Za-z0-9._ -]+/g, '_').slice(0, 120);
      if (!/^S\d+[A-Z]?$/.test(scene) || !/\.(mp4|mov|jpg|jpeg|png|webp|wav|mp3|m4a)$/i.test(name)) return send(res, 400, { error: 'need scene=S## and a media file name' });
      const tmp = path.join(JOBS, 'upload-' + crypto.randomBytes(6).toString('hex')); const w = fs.createWriteStream(tmp); let size = 0;
      req.on('data', c => { size += c.length; if (size > 1.5e9) req.destroy(); });
      req.pipe(w); await new Promise((ok, bad) => { w.on('finish', ok); w.on('error', bad); });
      return send(res, 202, view(enqueue('upload', { scene, name, tmp })));
    }
    send(res, 404, { error: 'unknown endpoint' });
  } catch (e) { send(res, 500, { error: String(e.message || e) }); }
}).listen(PORT, () => console.log('studio-api on :' + PORT));
