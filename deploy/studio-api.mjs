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
import { spawn, execFileSync } from 'node:child_process';
import { sha256, renderFingerprint, assertPreview } from '../tools/preview-provenance.mjs';

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
const pull = async (job) => { await git(job, 'checkout', '--', ...GENERATED).catch(() => {}); await git(job, 'pull', '-q', '--ff-only', 'origin', 'main'); };
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

// ---- auto-sync (2026-09-16): the server watches GitHub so agents only ever need GitHub ----
// Every minute: fetch main. New commits → pull + rebuild the page. If a cut or the storyboard source changed → render.
// Team uploads (Codex etc.) made through the BizBox connector land in R2 under TEAM_PREFIX and are mirrored to
// /data/media/team, which cuts can reference as folder "team".
const TEAM_PREFIX = process.env.TEAM_MEDIA_PREFIX || '';   // e.g. tenants/lyfe-team-xxxx/
const RENDER_TRIGGERS = [/^projects\/garage-dream\/cuts\/STORYBOARD-FINAL\.json$/];
const REBUILD_TRIGGERS = [/^projects\/garage-dream\/(source|cuts|deliveries)\//, /^projects\/garage-dream\/(INVENTORY|AUDIO)-MANIFEST\.json$/, /^tools\//];
const out = (args) => new Promise((ok) => { const p = spawn('git', args, { cwd: REPO }); let s = ''; p.stdout.on('data', (d) => { s += d; }); p.on('close', () => ok(s.trim())); });
let syncing = false;
async function autoSync() {
  if (syncing || running || queue.length) return; syncing = true;
  try {
    if (TEAM_PREFIX) await new Promise((ok) => spawn('rclone', ['copy', `${BUCKET}/${TEAM_PREFIX}`, path.join(MEDIA, 'team'), '--exclude', '*.keep', '-q'], { stdio: 'ignore' }).on('close', ok));
    await new Promise((ok) => spawn('git', ['fetch', '-q', 'origin', 'main'], { cwd: REPO, stdio: 'ignore' }).on('close', ok));
    const head = await out(['rev-parse', 'HEAD']); const remote = await out(['rev-parse', 'origin/main']);
    if (!remote || head === remote) return;
    const changed = (await out(['diff', '--name-only', head, remote])).split('\n').filter(Boolean);
    const behind = await out(['rev-list', '--count', `HEAD..origin/main`]);
    if (behind === '0') return;   // only our own local commits are ahead; nothing new from others
    const render = changed.some((f) => RENDER_TRIGGERS.some((re) => re.test(f)));
    const rebuild = render || changed.some((f) => REBUILD_TRIGGERS.some((re) => re.test(f)));
    const restart = changed.includes('deploy/studio-api.mjs');   // new server code: reload after this job (docker restarts us)
    const job = enqueue(render ? 'render' : rebuild ? 'pull' : 'fastforward', { auto: true, restart, changed: changed.slice(0, 40) });
    fs.appendFileSync(job.log, `auto-sync: ${behind} new commit(s) on main\n${changed.slice(0, 40).join('\n')}\n`);
  } catch (e) { console.error('auto-sync', e.message); }
  finally { syncing = false; }
}
RECIPES.fastforward = async (job) => { await pull(job); };
// merch uploads from the page: media/merch/<group>/, copied to cloud storage, board rebuilt (no repo change)
RECIPES.merch = async (job) => {
  const { group, name, tmp } = job.input; const dir = path.join(MEDIA, 'merch', group); fs.mkdirSync(dir, { recursive: true });
  let dest = path.join(dir, name); if (fs.existsSync(dest)) dest = path.join(dir, `${Date.now().toString(36)}-${name}`);
  fs.renameSync(tmp, dest);
  await sh(job, 'rclone', ['copy', dir, `${BUCKET}/media/merch/${group}`, '--stats-one-line']);
  await publishBoard(job);
  job.result = { file: dest };
};

// ---- previews: an agent PR that changes the cut gets a preview film before a person merges it ----
// Rendered with main's tools against the branch's files (a temporary git worktree), never committed.
// Listed in /data/editor/previews/previews.json; the storyboard page shows them under "Waiting for Rexx".
const PREV = path.join(EDITOR, 'previews'); fs.mkdirSync(PREV, { recursive: true });
const PREV_LIST = path.join(PREV, 'previews.json');
const CUT = 'projects/garage-dream/cuts/STORYBOARD-FINAL.json';
const readPrev = () => { try { return JSON.parse(fs.readFileSync(PREV_LIST, 'utf8')); } catch { return []; } };
const writePrev = (l) => fs.writeFileSync(PREV_LIST, JSON.stringify(l.slice(0, 30), null, 1));
const repoUrl = 'https://github.com/namesrexx-design/video-edit-room';
// Identity is based on the cut that actually renders, its sources and renderer.
// A branch commit alone is not a new film revision.
const mediaHashCache = new Map();
function mediaDigest(p) {
  const st = fs.statSync(p), stamp = `${st.size}:${st.mtimeMs}:${st.ctimeMs}`;
  const cached = mediaHashCache.get(p);
  if (cached?.stamp === stamp) return cached.hash;
  const hash = sha256(fs.readFileSync(p)); mediaHashCache.set(p, {stamp, hash}); return hash;
}
function describePreview(sha) {
  const gitRead = args => execFileSync('git', args, {cwd:REPO, maxBuffer:64e6});
  const bytes = gitRead(['show', `${sha}:${CUT}`]), cut = JSON.parse(bytes);
  const roots = {'capcut-kit-v74/SCENES_IN_ORDER':path.join(MEDIA,'garage-through-apu-review/capcut-kit-v74/SCENES_IN_ORDER'),
    'inventory-v74':path.join(MEDIA,'inventory-v74'),'audio-bin-v74':path.join(MEDIA,'audio-bin-v74'),
    'storyboard-final-20260915':path.join(MEDIA,'storyboard-final-20260915'),'final-pass-20260916':path.join(MEDIA,'final-pass-20260916'),'team':path.join(MEDIA,'team')};
  const sources = {};
  for (const b of [...cut.v1,...(cut.v2||[]),...(cut.a2||[])]) {
    const key = `${b.folder}/${b.file}`; if (sources[key]) continue;
    if (b.folder === 'repo-deliveries') {
      const rel = path.posix.normalize(`projects/garage-dream/deliveries/${b.file}`);
      if (!rel.startsWith('projects/garage-dream/deliveries/')) throw new Error('invalid delivery path');
      sources[key] = 'git:' + gitRead(['rev-parse', `${sha}:${rel}`]).toString().trim();
    } else {
      const root = roots[b.folder]; if (!root) throw new Error(`unknown source folder ${b.folder}`);
      const file = path.resolve(root,b.file); if (!file.startsWith(root+path.sep)) throw new Error('invalid media path');
      sources[key] = 'sha256:' + mediaDigest(file);
    }
  }
  const rendererSha256 = sha256(Buffer.concat(['render-cut.mjs','paths.mjs','otio.mjs'].map(f=>fs.readFileSync(path.join(REPO,'tools',f)))));
  return {cutSha256:sha256(bytes), fingerprint:renderFingerprint(cut,rendererSha256,sources), timelineFingerprint:renderFingerprint(cut,'',sources), rendererSha256, sourceVersions:sources};
}

RECIPES.preview = async (job) => {
  const { branch, sha } = job.input; const safe = branch.replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 60); const name = `PREVIEW-${safe}-${sha.slice(0, 7)}`;
  const wt = path.join(PREV, 'wt-' + sha.slice(0, 7));
  const set = (patch) => { const l = readPrev(); const i = l.findIndex((p) => p.sha === sha); if (i >= 0) { l[i] = { ...l[i], ...patch }; writePrev(l); } };
  try {
    if (!fs.existsSync(wt)) await git(job, 'worktree', 'add', '--detach', wt, sha);
    const requested = describePreview(sha);
    const previous = readPrev().find(p=>p.branch === branch && p.sha !== sha && p.outputSha256);
    await sh(job, 'node', [path.join(REPO, 'tools/render-cut.mjs'), CUT, name], { cwd: wt });
    const receiptPath = path.join(wt,'projects/garage-dream/renders/RECEIPTS',name+'.mp4.receipt.json');
    const receipt = JSON.parse(fs.readFileSync(receiptPath,'utf8'));
    const current = describePreview(sha);
    if (current.fingerprint !== requested.fingerprint) throw new Error('STALE_PREVIEW: sources changed during render');
    const rendered = path.join(wt,'projects/garage-dream/renders',name+'.mp4');
    const outputSha256 = sha256(fs.readFileSync(rendered));
    assertPreview({expectedCutSha:requested.cutSha256,fingerprint:requested.fingerprint,timelineFingerprint:requested.timelineFingerprint,actualOutputSha:outputSha256,receipt,previous});
    const film = path.join(PREV, name + '.mp4');
    fs.copyFileSync(path.join(wt, 'projects/garage-dream/renders', name + '.mp4'), film);
    if (sha256(fs.readFileSync(film)) !== outputSha256) throw new Error('STALE_PREVIEW: delivery copy hash mismatch');
    const provenance = {...receipt,...requested,branch,commit:sha,sourceTimeline:CUT,outputSha256,md5:crypto.createHash('md5').update(fs.readFileSync(film)).digest('hex'),serverVerified:true};
    fs.writeFileSync(path.join(PREV,name+'.receipt.json'),JSON.stringify(provenance,null,2));
    set({ state:'ready',film:'/editor/previews/'+name+'.mp4',receipt:'/editor/previews/'+name+'.receipt.json',ready_at:new Date().toISOString(),...requested,renderedCommit:sha,renderedCutSha256:requested.cutSha256,outputSha256,bytes:receipt.bytes,frames:receipt.frames });
    job.result = { preview: '/editor/previews/' + name + '.mp4' };
  } catch (e) { set({ state: 'failed', error: String(e.message || e).slice(0, 300) }); throw e; }
  finally { await git(job, 'worktree', 'remove', '--force', wt).catch(() => {}); }   // temporary checkout only
};
async function watchAgentBranches() {
  await new Promise((ok) => spawn('git', ['fetch', '-q', '--prune', 'origin', '+refs/heads/agent/*:refs/remotes/origin/agent/*'], { cwd: REPO, stdio: 'ignore' }).on('close', ok));
  const refs = (await out(['for-each-ref', '--format=%(refname:short) %(objectname)', 'refs/remotes/origin/agent'])).split('\n').filter(Boolean).map((l) => { const [ref, sha] = l.split(' '); return { branch: ref.replace(/^origin\//, ''), sha }; });
  const list = readPrev();
  for (const p of list) {   // merged or superseded?
    if (p.state === 'merged') continue;
    const merged = await new Promise((ok) => spawn('git', ['merge-base', '--is-ancestor', p.sha, 'origin/main'], { cwd: REPO }).on('close', (c) => ok(c === 0)));
    if (merged) p.state = 'merged';
    else if (!refs.some((r) => r.branch === p.branch && r.sha === p.sha) && p.state !== 'superseded') p.state = 'superseded';
  }
  for (const r of refs) {
    if (list.some((p) => p.sha === r.sha)) continue;
    const ahead = await out(['rev-list', '--count', `origin/main..${r.sha}`]); if (ahead === '0') continue;
    const touches = (await out(['diff', '--name-only', `origin/main...${r.sha}`])).split('\n').includes(CUT);
    if (!touches) continue;
    let identity;
    try { identity = describePreview(r.sha); }
    catch (e) { list.unshift({branch:r.branch,sha:r.sha,state:'failed',at:new Date().toISOString(),error:`Preview inputs unavailable: ${e.message}`}); writePrev(list); continue; }
    const reusable = list.find(p=>p.branch === r.branch && p.fingerprint === identity.fingerprint && p.outputSha256 && p.film && fs.existsSync(path.join(EDITOR,p.film.replace(/^\/editor\//,''))));
    if (reusable && mediaDigest(path.join(EDITOR,reusable.film.replace(/^\/editor\//,''))) === reusable.outputSha256) {
      list.unshift({...reusable,...identity,branch:r.branch,sha:r.sha,state:'ready',reusedFrom:reusable.sha,renderedCommit:reusable.renderedCommit||reusable.sha,renderedCutSha256:reusable.renderedCutSha256||reusable.cutSha256,at:new Date().toISOString(),subject:await out(['log','-1','--format=%s',r.sha])});
      writePrev(list); continue;
    }
    list.unshift({ branch: r.branch, sha: r.sha, state: 'rendering', at: new Date().toISOString(), ...identity, pr: `${repoUrl}/pulls?q=is%3Apr+head%3A${encodeURIComponent(r.branch)}`, subject: await out(['log', '-1', '--format=%s', r.sha]) });
    writePrev(list);
    enqueue('preview', { branch: r.branch, sha: r.sha });
  }
  writePrev(list);
}
setInterval(() => { if (!running && !queue.length) watchAgentBranches().catch((e) => console.error('previews', e.message)); }, 2 * 60 * 1000);
setInterval(autoSync, 60 * 1000); setTimeout(autoSync, 15 * 1000);

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
  running.endedAt = new Date().toISOString();
  if (running.input?.restart && running.state === 'done') { fs.appendFileSync(running.log, '\nrestarting to load the new server code\n'); setTimeout(() => process.exit(0), 500); }
  running = null; pump();
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
    if (req.method === 'POST' && p === '/upload' && u.searchParams.get('merch')) {
      const group = u.searchParams.get('merch'); const name = (u.searchParams.get('name') || '').replace(/[^A-Za-z0-9._ -]+/g, '_').slice(0, 120);
      if (!['hats', 'mugs', 'shirts', 'shirt-designs'].includes(group) || !/\.(png|jpe?g|webp|mp4|mov|webm)$/i.test(name)) return send(res, 400, { error: 'need merch=hats|mugs|shirts|shirt-designs and a picture or video' });
      const tmp = path.join(JOBS, 'upload-' + crypto.randomBytes(6).toString('hex')); const w = fs.createWriteStream(tmp); let size = 0;
      req.on('data', c => { size += c.length; if (size > 1.5e9) req.destroy(); });
      req.pipe(w); await new Promise((ok, bad) => { w.on('finish', ok); w.on('error', bad); });
      return send(res, 202, view(enqueue('merch', { group, name, tmp })));
    }
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
