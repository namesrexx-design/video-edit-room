// BizBox connector — one address for every member's own AI agent (2026-09-16).
//
//   https://mcp.biz-box.io/mcp            key in the header:  Authorization: Bearer bbx_…
//   https://mcp.biz-box.io/mcp/<key>      key in the link (for apps that cannot send headers)
//
// The key is checked with BizBox (workspaceAuth). Every tool works ONLY inside that workspace's
// storage folder (tenants/<slug>/) in Cloudflare R2. A second loop copies members' page uploads
// into their folders (intake), and a small queue runs jobs with a per-workspace limit.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const PORT = Number(process.env.CONNECTOR_PORT || 8790);
const PUBLIC_URL = process.env.CONNECTOR_PUBLIC_URL || 'https://mcp.biz-box.io';
const FN = process.env.BIZBOX_FUNCTIONS || 'https://app.biz-box.io/api/functions';
const BUCKET = process.env.R2_BUCKET || 'lyfe-studio';
const SIGNING_KEY = crypto.createPrivateKey(fs.readFileSync(process.env.SIGNING_KEY_FILE || '/run/connector/signing.pem'));
const JOBS_DIR = process.env.CONNECTOR_JOBS_DIR || '/data/connector-jobs';
const BG_REMOVAL = process.env.BG_REMOVAL_MODULE || '/opt/tools-bg/node_modules/@imgly/background-removal-node/dist/index.mjs';
fs.mkdirSync(JOBS_DIR, { recursive: true });

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.RCLONE_CONFIG_R2_ENDPOINT,
  credentials: { accessKeyId: process.env.RCLONE_CONFIG_R2_ACCESS_KEY_ID, secretAccessKey: process.env.RCLONE_CONFIG_R2_SECRET_ACCESS_KEY },
});
const log = (...a) => console.log(new Date().toISOString(), ...a);

// ---------- BizBox calls ----------
async function signedCall(body) {
  const raw = JSON.stringify(body); const ts = Math.floor(Date.now() / 1000);
  const sig = crypto.sign(null, Buffer.from(`${ts}.${raw}`), SIGNING_KEY).toString('base64');
  const r = await fetch(`${FN}/workspaceServer`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-bbx-ts': String(ts), 'x-bbx-sig': sig }, body: raw });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`workspaceServer ${r.status}: ${j.error || ''}`);
  return j;
}
const authCache = new Map();   // sha256(key) → {ws, until}
async function workspaceFor(key) {
  if (!/^bbx_[A-Za-z0-9_-]{40,60}$/.test(key || '')) return null;
  const h = crypto.createHash('sha256').update(key).digest('hex');
  const c = authCache.get(h); if (c && c.until > Date.now()) return c.ws;
  const r = await fetch(`${FN}/workspaceAuth`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key }) });
  const ws = r.ok ? await r.json() : null;
  authCache.set(h, { ws, until: Date.now() + (ws ? 5 : 1) * 60 * 1000 });
  return ws;
}

// ---------- paths: everything stays inside tenants/<slug>/ ----------
function inside(ws, rel = '') {
  const clean = String(rel).replace(/\\/g, '/').replace(/^\/+/, '');
  if (clean.split('/').some((p) => p === '..' || p === '.')) throw new Error('Paths cannot contain . or .. segments.');
  if (/[\x00-\x1f]/.test(clean)) throw new Error('Path has control characters.');
  const prefix = ws.storage_prefix.endsWith('/') ? ws.storage_prefix : ws.storage_prefix + '/';
  if (!/^tenants\/[a-z0-9-]+\/$/.test(prefix)) throw new Error('Workspace folder is not valid.');
  return prefix + clean;
}
const rel = (ws, key) => key.slice(ws.storage_prefix.length);
const TEXTY = /\.(txt|md|json|jsonc|csv|tsv|html?|css|js|mjs|ts|jsx|tsx|xml|yaml|yml|srt|vtt|edl|otio|svg)$/i;
const text = (t) => ({ content: [{ type: 'text', text: typeof t === 'string' ? t : JSON.stringify(t, null, 2) }] });

// ---------- job queue: one job at a time on this box, max job_limit waiting per workspace ----------
const jobs = new Map(); const queue = []; let running = null;
function addJob(ws, kind, input) {
  const open = [...jobs.values()].filter((j) => j.workspace_id === ws.workspace_id && (j.state === 'queued' || j.state === 'running'));
  if (open.length >= Math.max(1, ws.job_limit || 1)) throw new Error(`This workspace already has ${open.length} job(s) waiting. Check job_status and try again when it finishes.`);
  const job = { id: `${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`, workspace_id: ws.workspace_id, ws, kind, input, state: 'queued', at: new Date().toISOString(), log: [] };
  jobs.set(job.id, job); queue.push(job); pump(); return job;
}
const jobView = (j) => ({ id: j.id, kind: j.kind, state: j.state, at: j.at, started: j.started, ended: j.ended, result: j.result, error: j.error, log: j.log.slice(-15) });
async function pump() {
  if (running || !queue.length) return;
  running = queue.shift(); running.state = 'running'; running.started = new Date().toISOString();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'job-'));
  try { running.result = await RUNNERS[running.kind](running, dir); running.state = 'done'; }
  catch (e) { running.state = 'failed'; running.error = String(e.message || e).slice(0, 400); }
  finally { running.ended = new Date().toISOString(); fs.rmSync(dir, { recursive: true, force: true }); log('job', running.id, running.kind, running.state, running.error || ''); running = null; setImmediate(pump); }
}
async function download(ws, relPath, dest) {
  const o = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: inside(ws, relPath) }));
  await pipeline(o.Body, fs.createWriteStream(dest));
}
async function upload(ws, relPath, file, contentType) {
  const Key = inside(ws, relPath);
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key, Body: fs.createReadStream(file), ContentLength: fs.statSync(file).size, ContentType: contentType }));
  signedCall({ action: 'connector_log', workspace_id: ws.workspace_id, name: path.basename(relPath), storage_path: relPath, size_bytes: fs.statSync(file).size, content_type: contentType }).catch((e) => log('log failed', e.message));
  return relPath;
}
const run = (job, cmd, args) => new Promise((ok, bad) => {
  const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] }); let err = '';
  p.stderr.on('data', (d) => { err = (err + d).slice(-2000); });
  const t = setTimeout(() => p.kill('SIGKILL'), 30 * 60 * 1000);
  p.on('close', (c) => { clearTimeout(t); c === 0 ? ok() : bad(new Error(`${cmd} failed: ${err.split('\n').filter(Boolean).slice(-2).join(' ')}`)); });
});
const RUNNERS = {
  // any video → 1080p H.264/AAC mp4 at the chosen frame rate
  async convert_video(job, dir) {
    const { path: src, output, fps } = job.input; const inF = path.join(dir, 'in' + path.extname(src)); const outF = path.join(dir, 'out.mp4');
    job.log.push('downloading'); await download(job.ws, src, inF);
    job.log.push('converting');
    await run(job, 'ffmpeg', ['-v', 'error', '-y', '-i', inF, '-vf', `scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:-1:-1,fps=${fps || 24},format=yuv420p`, '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', outF]);
    const dest = output || src.replace(/\.[^./]+$/, '') + '-1080p.mp4';
    job.log.push('saving'); return { saved: await upload(job.ws, dest, outF, 'video/mp4') };
  },
  // photo → same photo with the background removed (transparent PNG)
  async remove_background(job, dir) {
    const { path: src, output } = job.input; const inF = path.join(dir, 'in' + path.extname(src)); const png = path.join(dir, 'in.png'); const outF = path.join(dir, 'out.png');
    job.log.push('downloading'); await download(job.ws, src, inF);
    await run(job, 'ffmpeg', ['-v', 'error', '-y', '-i', inF, '-frames:v', '1', '-pix_fmt', 'rgba', png]);
    job.log.push('removing background');
    const { removeBackground } = await import(BG_REMOVAL);
    const blob = await removeBackground(new Blob([fs.readFileSync(png)], { type: 'image/png' }), { publicPath: 'file://' + path.dirname(BG_REMOVAL) + '/', model: 'medium', output: { format: 'image/png' } });
    fs.writeFileSync(outF, Buffer.from(await blob.arrayBuffer()));
    const dest = output || src.replace(/\.[^./]+$/, '') + '-CUTOUT.png';
    job.log.push('saving'); return { saved: await upload(job.ws, dest, outF, 'image/png') };
  },
  // storyboard/storyboard.json → one film: every scene in order, every clip normalized to 1080p/24/stereo, joined
  async render_storyboard(job, dir) {
    const sb = await readBoard(job.ws);
    const parts = [];
    for (const sc of sb.scenes || []) {
      if (sc.removed) continue;
      for (const c of sc.clips || []) {
        const clip = typeof c === 'string' ? { path: c } : c; if (!clip?.path) continue;
        const i = parts.length; const src = path.join(dir, `src${i}${path.extname(clip.path)}`); const out = path.join(dir, `part${i}.mp4`);
        job.log.push(`${sc.id || 'scene'}: ${clip.path}`); await download(job.ws, clip.path, src);
        const cut = [...(clip.in ? ['-ss', String(clip.in)] : []), ...(clip.out ? ['-to', String(clip.out)] : [])];
        const hasAudio = await probeAudio(src);
        const args = ['-v', 'error', '-y', ...cut, '-i', src];
        if (!hasAudio) args.push('-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo');
        args.push('-map', '0:v:0', '-map', hasAudio ? '0:a:0' : '1:a:0', '-shortest', '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:-1:-1,fps=24,format=yuv420p,setsar=1', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-c:a', 'aac', '-ar', '48000', '-ac', '2', '-b:a', '192k', out);
        await run(job, 'ffmpeg', args); fs.rmSync(src); parts.push(out);
      }
    }
    if (!parts.length) throw new Error('The storyboard has no clips yet. Add clip paths to scenes in storyboard/storyboard.json.');
    const list = path.join(dir, 'list.txt'); fs.writeFileSync(list, parts.map((p) => `file '${p}'`).join('\n'));
    const film = path.join(dir, 'film.mp4'); job.log.push(`joining ${parts.length} clips`);
    await run(job, 'ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', film]);
    const dest = `storyboard/renders/FILM-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.mp4`;
    job.log.push('saving'); return { saved: await upload(job.ws, dest, film, 'video/mp4'), clips: parts.length };
  },
};
const probeAudio = (f) => new Promise((ok) => { const p = spawn('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', f]); let o = ''; p.stdout.on('data', (d) => { o += d; }); p.on('close', () => ok(o.trim().length > 0)); });
async function readBoard(ws) {
  const o = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: inside(ws, 'storyboard/storyboard.json') }));
  try { return JSON.parse(await o.Body.transformToString('utf8')); } catch { throw new Error('storyboard/storyboard.json is not valid JSON.'); }
}

// ---------- module starter kits ----------
const STARTERS = {
  storyboard: {
    'storyboard/storyboard.json': JSON.stringify({
      format: 'bizbox-storyboard-1', title: 'My first film',
      notes: 'Scenes play in this order. Each clip is a path inside this workspace, with optional in/out seconds. Set "removed": true to leave a scene out without losing it.',
      scenes: [
        { id: 'S01', title: 'Opening', line: 'What is said in this scene.', cast: [], set: '', frames: { start: '', end: '' }, clips: [], audio: [], removed: false },
        { id: 'S02', title: 'Second scene', line: '', cast: [], set: '', frames: { start: '', end: '' }, clips: [], audio: [], removed: false },
      ],
    }, null, 2),
    'storyboard/README.md': '# Storyboard\n\n- Put video clips in `storyboard/clips/`, stills in `storyboard/stills/`, sound in `storyboard/audio/`.\n- List them per scene in `storyboard.json`, e.g. `"clips": [{ "path": "storyboard/clips/walk.mp4", "in": 0, "out": 4.5 }]`.\n- Ask BizBox to run the `render_storyboard` job. The film lands in `storyboard/renders/`.\n- Watch the board on your private board page (link from `board_link`).\n',
  },
  crm: {
    'crm/README.md': '# Leads and follow-up\n\nEvery enquiry from your BizBox pages is kept in BizBox and followed up automatically.\nUse `crm/contacts.csv` for people you want imported.\n',
    'crm/contacts.csv': 'name,email,phone,source,notes\n',
  },
  storefront: {
    'storefront/README.md': '# Storefront\n\nOpen your shop at https://app.biz-box.io/sell. Put product photos in `storefront/photos/` and your copy in `storefront/copy.md`.\n',
    'storefront/copy.md': '# Shop name\n\n## What you sell, in one line\n\n## Headline\n\n## What they get\n- \n- \n\n## Price\n',
  },
  intake: { 'intake/README.md': '# Intake\n\nFiles you upload on https://biz-box.io/workspace are copied here.\n' },
};
async function exists(ws, p) { try { await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: inside(ws, p) })); return true; } catch { return false; } }
async function setUpModule(ws, module) {
  const files = STARTERS[module]; if (!files) throw new Error('Unknown module.');
  const made = [];
  for (const [p, body] of Object.entries(files)) {
    if (await exists(ws, p)) continue;   // never overwrite the member's work
    await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: inside(ws, p), Body: body, ContentType: p.endsWith('.json') ? 'application/json' : 'text/plain; charset=utf-8' }));
    made.push(p);
  }
  return made;
}

// ---------- private board page: /board/<key> ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const link = (ws, p) => getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: inside(ws, p) }), { expiresIn: 3600 });
async function boardPage(ws) {
  let sb; try { sb = await readBoard(ws); } catch { sb = null; }
  const renders = (await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: inside(ws, 'storyboard/renders/') }))).Contents || [];
  const latest = renders.sort((a, b) => b.LastModified - a.LastModified)[0];
  const film = latest ? await link(ws, rel(ws, latest.Key)) : null;
  const scenes = [];
  for (const sc of sb?.scenes || []) {
    const media = [];
    for (const k of ['start', 'end']) if (sc.frames?.[k]) media.push(`<figure><img loading="lazy" src="${esc(await link(ws, sc.frames[k]).catch(() => ''))}" alt=""><figcaption>${k} frame</figcaption></figure>`);
    for (const c of sc.clips || []) { const p = typeof c === 'string' ? c : c.path; if (p) media.push(`<figure><video controls preload="none" src="${esc(await link(ws, p).catch(() => ''))}"></video><figcaption>${esc(p.split('/').pop())}</figcaption></figure>`); }
    for (const a of sc.audio || []) { const p = typeof a === 'string' ? a : a.path; if (p) media.push(`<figure><audio controls preload="none" src="${esc(await link(ws, p).catch(() => ''))}"></audio><figcaption>${esc(p.split('/').pop())}</figcaption></figure>`); }
    scenes.push(`<article class="${sc.removed ? 'off' : ''}"><h2><span>${esc(sc.id)}</span> ${esc(sc.title)}${sc.removed ? ' <em>left out</em>' : ''}</h2>${sc.line ? `<p class="line">${esc(sc.line)}</p>` : ''}<div class="media">${media.join('') || '<p class="empty">No clips yet.</p>'}</div></article>`);
  }
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(sb?.title || ws.name)} · BizBox storyboard</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,500&family=Source+Sans+3:wght@400;600&display=swap" rel="stylesheet">
<style>:root{--ink:#2b2620;--muted:#6f655a;--ground:#f3efe7;--card:#fbf8f1;--line:#ddd3c2;--clay:#a8583a}
body{margin:0;background:var(--ground);color:var(--ink);font:17px/1.5 "Source Sans 3",system-ui,sans-serif}
.wrap{max-width:1100px;margin:0 auto;padding:28px 16px 60px}h1{font:500 40px/1.1 Newsreader,Georgia,serif;margin:0 0 4px;text-wrap:balance}
.brand{font:600 13px "Source Sans 3",sans-serif;letter-spacing:.14em;text-transform:uppercase;color:var(--clay)}.sub{color:var(--muted);margin:0 0 22px}
.film video{width:100%;border-radius:12px;background:#000}article{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px;margin:16px 0}
article.off{opacity:.55}h2{font:500 24px Newsreader,Georgia,serif;margin:0 0 6px}h2 span{font:600 14px "Source Sans 3";color:var(--clay);margin-right:6px}
.line{margin:0 0 10px;font-style:italic}.media{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}
figure{margin:0}img,video{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:8px;background:#e6dfd2}audio{width:100%}figcaption{font-size:14px;color:var(--muted);overflow-wrap:anywhere}.empty{color:var(--muted);margin:0}em{font-size:14px;color:var(--muted)}</style></head>
<body><div class="wrap"><div class="brand">BizBox · ${esc(ws.name)}</div><h1>${esc(sb?.title || 'Storyboard')}</h1><p class="sub">${sb ? `${(sb.scenes || []).length} scenes. Links on this page work for one hour; reload for fresh ones.` : 'No storyboard yet. Turn on the Storyboard module and ask your agent to set it up.'}</p>
${film ? `<section class="film"><video controls preload="metadata" src="${esc(film)}"></video><p class="sub">Latest film: ${esc(latest.Key.split('/').pop())}</p></section>` : ''}${scenes.join('')}</div></body></html>`;
}

// ---------- the MCP server for one workspace ----------
function serverFor(ws) {
  const s = new McpServer({ name: 'bizbox', version: '1.0.0' }, { instructions: `You are connected to the BizBox workspace "${ws.name}". Every path is relative to this workspace's private folder. Uploads the member made on biz-box.io/workspace appear under intake/.` });
  const safe = (fn) => async (args) => { try { return await fn(args); } catch (e) { return { isError: true, content: [{ type: 'text', text: String(e.message || e) }] }; } };

  s.registerTool('workspace_info', { title: 'Workspace info', description: 'Name, modules turned on, and plan of this BizBox workspace.', inputSchema: {} },
    safe(async () => text({ name: ws.name, modules: ws.modules, plan: ws.plan, job_limit: ws.job_limit, folders: ['intake/ (member uploads)', 'anything else you create'] })));

  s.registerTool('list_files', { title: 'List files', description: 'List files in a folder of this workspace (default: the top). Returns path, size and last change.', inputSchema: { folder: z.string().optional().describe('Folder inside the workspace, e.g. "intake/"'), cursor: z.string().optional() } },
    safe(async ({ folder = '', cursor }) => {
      const Prefix = inside(ws, folder && !folder.endsWith('/') ? folder + '/' : folder);
      const r = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix, Delimiter: '/', MaxKeys: 200, ContinuationToken: cursor }));
      return text({ folders: (r.CommonPrefixes || []).map((p) => rel(ws, p.Prefix)), files: (r.Contents || []).map((o) => ({ path: rel(ws, o.Key), bytes: o.Size, changed: o.LastModified })), next_cursor: r.NextContinuationToken || null });
    }));

  s.registerTool('read_text_file', { title: 'Read a text file', description: 'Read a text file (up to 512 KB) from this workspace. For images, video or audio use get_download_link.', inputSchema: { path: z.string() } },
    safe(async ({ path: p }) => {
      if (!TEXTY.test(p)) throw new Error('Not a text file. Use get_download_link for media.');
      const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: inside(ws, p) }));
      if (head.ContentLength > 512 * 1024) throw new Error('File is larger than 512 KB. Use get_download_link.');
      const o = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: inside(ws, p) }));
      return text(await o.Body.transformToString('utf8'));
    }));

  s.registerTool('write_text_file', { title: 'Write a text file', description: 'Create or replace a text file (up to 2 MB) in this workspace.', inputSchema: { path: z.string(), content: z.string().max(2 * 1024 * 1024) } },
    safe(async ({ path: p, content }) => {
      if (!TEXTY.test(p)) throw new Error('Use a text file name (.md, .json, .txt, .csv, .html …). For media use get_upload_link.');
      await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: inside(ws, p), Body: content, ContentType: 'text/plain; charset=utf-8' }));
      signedCall({ action: 'connector_log', workspace_id: ws.workspace_id, name: path.basename(p), storage_path: p, size_bytes: Buffer.byteLength(content), content_type: 'text/plain' }).catch(() => {});
      return text(`Saved ${p}`);
    }));

  s.registerTool('get_download_link', { title: 'Download link', description: 'A private link (valid 1 hour) to download or view a file from this workspace.', inputSchema: { path: z.string() } },
    safe(async ({ path: p }) => text({ path: p, url: await getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: inside(ws, p) }), { expiresIn: 3600 }), expires_in_seconds: 3600 })));

  s.registerTool('get_upload_link', { title: 'Upload link', description: 'A private link (valid 1 hour) to upload a file of any size into this workspace with an HTTP PUT.', inputSchema: { path: z.string(), content_type: z.string().optional() } },
    safe(async ({ path: p, content_type }) => text({ path: p, method: 'PUT', url: await getSignedUrl(s3, new PutObjectCommand({ Bucket: BUCKET, Key: inside(ws, p), ContentType: content_type }), { expiresIn: 3600 }), headers: content_type ? { 'Content-Type': content_type } : {}, expires_in_seconds: 3600 })));

  s.registerTool('start_job', { title: 'Start a job', description: 'Ask the BizBox server to do work in this workspace. convert_video: any video to a 1080p MP4. remove_background: a photo to a transparent PNG cutout. render_storyboard: storyboard/storyboard.json to one film in storyboard/renders/ (no path needed). Returns a job id; check it with job_status.', inputSchema: { kind: z.enum(['convert_video', 'remove_background', 'render_storyboard']), path: z.string().optional().describe('Source file inside the workspace (not needed for render_storyboard)'), output: z.string().optional().describe('Where to save the result (optional)'), fps: z.number().int().min(12).max(60).optional() } },
    safe(async ({ kind, path: p, output, fps }) => {
      if (kind !== 'render_storyboard') { if (!p) throw new Error('This job needs a path.'); inside(ws, p); }
      if (kind === 'render_storyboard' && !(ws.modules || []).includes('storyboard')) throw new Error('Turn on the Storyboard module on https://biz-box.io/workspace first.');
      if (output) inside(ws, output);
      return text(jobView(addJob(ws, kind, { path: p, output, fps })));
    }));

  s.registerTool('set_up_module', { title: 'Set up a module', description: 'Create the starter files for a module turned on in this workspace (storyboard, crm, storefront, intake). Existing files are never overwritten.', inputSchema: { module: z.enum(['storyboard', 'crm', 'storefront', 'intake']) } },
    safe(async ({ module }) => {
      if (!(ws.modules || []).includes(module)) throw new Error(`The ${module} module is off. The member can turn it on at https://biz-box.io/workspace.`);
      const made = await setUpModule(ws, module);
      return text(made.length ? { created: made } : 'Already set up; nothing changed.');
    }));

  s.registerTool('board_link', { title: 'Storyboard page link', description: 'The private web page showing this workspace\'s storyboard, clips and latest film. Anyone with the link can view it, so share it only with the member.', inputSchema: {} },
    safe(async () => text({ url: `${PUBLIC_URL}/board/${ws._key}`, note: 'This link contains the workspace key. Treat it like a password.' })));

  s.registerTool('job_status', { title: 'Job status', description: 'Status of this workspace\'s jobs (one job, or the most recent ones).', inputSchema: { id: z.string().optional() } },
    safe(async ({ id }) => {
      const mine = [...jobs.values()].filter((j) => j.workspace_id === ws.workspace_id);
      if (id) { const j = mine.find((x) => x.id === id); if (!j) throw new Error('No such job in this workspace.'); return text({ ...jobView(j), place_in_line: j.state === 'queued' ? queue.indexOf(j) + 1 : 0 }); }
      return text(mine.slice(-20).reverse().map(jobView));
    }));
  return s;
}

// ---------- intake: copy page uploads into workspace folders ----------
let intakeBusy = false;
async function intakeTick() {
  if (intakeBusy) return; intakeBusy = true;
  try {
    const { files = [] } = await signedCall({ action: 'intake_queue' });
    for (const f of files) {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'intake-'));
      try {
        const u = new URL(f.url); if (u.protocol !== 'https:') throw new Error('not https');
        const r = await fetch(u, { redirect: 'follow' }); if (!r.ok || !r.body) throw new Error(`download ${r.status}`);
        const tmp = path.join(dir, 'file'); await pipeline(Readable.fromWeb(r.body), fs.createWriteStream(tmp));
        const size = fs.statSync(tmp).size; if (size > 5e9) throw new Error('file over 5 GB');
        const ws = { workspace_id: null, storage_prefix: f.storage_prefix };
        const name = String(f.name).replace(/[\\/\x00-\x1f]/g, '_').slice(0, 120) || 'file';
        let relPath = `intake/${name}`;
        try { await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: inside(ws, relPath) })); relPath = `intake/${Date.now().toString(36)}-${name}`; } catch { /* free name */ }
        await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: inside(ws, relPath), Body: fs.createReadStream(tmp), ContentLength: size, ContentType: f.content_type || r.headers.get('content-type') || undefined }));
        await signedCall({ action: 'intake_mark', id: f.id, status: 'synced', storage_path: relPath });
        log('intake synced', f.storage_prefix + relPath, size);
      } catch (e) {
        log('intake failed', f.id, e.message);
        await signedCall({ action: 'intake_mark', id: f.id, status: 'failed', error: String(e.message || e) }).catch(() => {});
      } finally { fs.rmSync(dir, { recursive: true, force: true }); }
    }
  } catch (e) { log('intake tick', e.message); }
  intakeBusy = false;
}
setInterval(intakeTick, 60 * 1000); setTimeout(intakeTick, 5000);

// ---------- module setup: starter files appear as soon as a member turns a module on ----------
let setupBusy = false;
async function setupTick() {
  if (setupBusy) return; setupBusy = true;
  try {
    const { workspaces = [] } = await signedCall({ action: 'setup_queue' });
    for (const w of workspaces) {
      const done = [];
      for (const m of w.pending) {
        try { if (STARTERS[m]) await setUpModule(w, m); done.push(m); if (m === 'storyboard') for (const d of ['clips', 'stills', 'audio']) if (!(await exists(w, `storyboard/${d}/.keep`))) await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: inside(w, `storyboard/${d}/.keep`), Body: '' })); }
        catch (e) { log('setup failed', w.slug, m, e.message); }
      }
      if (done.length) { await signedCall({ action: 'setup_mark', workspace_id: w.workspace_id, modules: done }); log('modules ready', w.slug, done.join(',')); }
    }
  } catch (e) { log('setup tick', e.message); }
  setupBusy = false;
}
setInterval(setupTick, 60 * 1000); setTimeout(setupTick, 8000);

// ---------- studio API for the biz-box.io/lyfestudio page (member signed in to BizBox) ----------
// The page sends the member's own BizBox login token. We ask BizBox (myWorkspace) who that is; no shared secret.
const ORIGINS = [/^https:\/\/(www\.|app\.)?biz-box\.io$/, /^https:\/\/[a-z0-9-]+\.base44\.app$/, /^https:\/\/preview-sandbox--[a-z0-9-]+\.base44\.app$/];
const userCache = new Map();
async function workspaceForUser(token) {
  if (!token || token.length > 4000) return null;
  const h = crypto.createHash('sha256').update(token).digest('hex');
  const c = userCache.get(h); if (c && c.until > Date.now()) return c.ws;
  const r = await fetch(`${FN}/myWorkspace`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: '{"action":"get"}' });
  const j = r.ok ? await r.json().catch(() => null) : null;
  const w = j?.workspace?.status === 'active' ? { workspace_id: j.workspace.id, name: j.workspace.name, slug: j.workspace.slug, storage_prefix: j.workspace.storage_prefix, modules: j.workspace.modules || [], plan: j.workspace.plan, job_limit: j.workspace.job_limit || 1 } : null;
  userCache.set(h, { ws: w, until: Date.now() + (w ? 60 : 15) * 1000 });
  return w;
}
function validBoard(b) {
  if (!b || typeof b !== 'object' || !Array.isArray(b.scenes)) throw new Error('A storyboard needs a scenes list.');
  if (b.scenes.length > 300) throw new Error('Too many scenes.');
  const str = (v, n) => String(v ?? '').slice(0, n);
  const media = (arr) => (Array.isArray(arr) ? arr : []).slice(0, 50).map((c) => { const p = typeof c === 'string' ? c : c?.path; return p ? { path: str(p, 300), ...(c?.in != null ? { in: Math.max(0, +c.in || 0) } : {}), ...(c?.out != null ? { out: Math.max(0, +c.out || 0) } : {}) } : null; }).filter(Boolean);
  return {
    format: 'bizbox-storyboard-1', title: str(b.title || 'My film', 120), notes: str(b.notes, 2000),
    scenes: b.scenes.map((s, i) => ({ id: str(s.id || `S${String(i + 1).padStart(2, '0')}`, 12), title: str(s.title, 160), line: str(s.line, 2000), cast: (Array.isArray(s.cast) ? s.cast : []).slice(0, 20).map((x) => str(x, 60)), set: str(s.set, 80), frames: { start: str(s.frames?.start, 300), end: str(s.frames?.end, 300) }, clips: media(s.clips), audio: media(s.audio), removed: !!s.removed })),
  };
}
async function studioState(ws) {
  let board = null; try { board = await readBoard(ws); } catch { board = null; }
  const sign = (p) => (p ? link(ws, p).catch(() => null) : null);
  const scenes = [];
  for (const sc of board?.scenes || []) {
    scenes.push({ ...sc, urls: {
      start: await sign(sc.frames?.start), end: await sign(sc.frames?.end),
      clips: await Promise.all((sc.clips || []).map((c) => sign(c.path || c))),
      audio: await Promise.all((sc.audio || []).map((a) => sign(a.path || a))),
    } });
  }
  const list = async (folder) => ((await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: inside(ws, folder), MaxKeys: 500 }))).Contents || []).map((o) => ({ path: rel(ws, o.Key), bytes: o.Size, changed: o.LastModified }));
  const renders = (await list('storyboard/renders/')).sort((a, b) => new Date(b.changed) - new Date(a.changed));
  const film = renders[0] ? { ...renders[0], url: await sign(renders[0].path) } : null;
  const library = [...await list('storyboard/clips/'), ...await list('storyboard/stills/'), ...await list('storyboard/audio/'), ...await list('intake/')].filter((f) => !f.path.endsWith('/') && !/README\.md$/.test(f.path));
  const jobsMine = [...jobs.values()].filter((j) => j.workspace_id === ws.workspace_id).slice(-10).reverse().map(jobView);
  return { workspace: { name: ws.name, modules: ws.modules, plan: ws.plan }, board: board ? { ...board, scenes } : null, film, renders: renders.slice(0, 10), library, jobs: jobsMine };
}
async function studioApi(req, res, u) {
  const origin = req.headers.origin || '';
  const cors = ORIGINS.some((re) => re.test(origin)) ? { 'access-control-allow-origin': origin, vary: 'Origin', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-max-age': '600' } : {};
  const send = (code, body) => { res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store', ...cors }); res.end(JSON.stringify(body)); };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  let ws = null; try { ws = await workspaceForUser(token); } catch (e) { log('studio auth', e.message); }
  if (!ws) return send(401, { error: 'Sign in to BizBox first.' });
  const route = u.pathname.replace(/^\/api\/studio/, '') || '/';
  const readJson = async () => { let raw = ''; for await (const c of req) { raw += c; if (raw.length > 1e6) throw new Error('Too large.'); } return raw ? JSON.parse(raw) : {}; };
  try {
    if (req.method === 'GET' && route === '/') return send(200, await studioState(ws));
    if (!ws.modules.includes('storyboard')) {   // just turned on? ask BizBox again instead of trusting the 60 s cache
      userCache.delete(crypto.createHash('sha256').update(token).digest('hex'));
      ws = await workspaceForUser(token);
      if (!ws?.modules.includes('storyboard')) return send(403, { error: 'Turn on the Storyboard module first.' });
    }
    if (req.method === 'POST' && route === '/setup') { await setUpModule(ws, 'storyboard'); for (const d of ['clips', 'stills', 'audio']) if (!(await exists(ws, `storyboard/${d}/.keep`))) await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: inside(ws, `storyboard/${d}/.keep`), Body: '' })); return send(200, await studioState(ws)); }
    if (req.method === 'POST' && route === '/board') {
      const b = validBoard((await readJson()).board);
      for (const s of b.scenes) for (const p of [s.frames.start, s.frames.end, ...s.clips.map((c) => c.path), ...s.audio.map((a) => a.path)]) if (p) inside(ws, p);
      await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: inside(ws, 'storyboard/storyboard.json'), Body: JSON.stringify(b, null, 2), ContentType: 'application/json' }));
      return send(200, await studioState(ws));
    }
    if (req.method === 'POST' && route === '/render') { const j = addJob(ws, 'render_storyboard', {}); return send(202, jobView(j)); }
    if (req.method === 'POST' && route === '/upload') {
      const name = String(u.searchParams.get('name') || '').replace(/[\\/\x00-\x1f]/g, '_').slice(0, 120);
      const kind = /\.(mp4|mov|m4v|webm)$/i.test(name) ? 'clips' : /\.(png|jpe?g|webp)$/i.test(name) ? 'stills' : /\.(wav|mp3|m4a|aac)$/i.test(name) ? 'audio' : null;
      if (!name || !kind) return send(400, { error: 'Upload a video, photo or sound file.' });
      const size = Number(req.headers['content-length'] || 0);
      if (!size || size > 2e9) return send(413, { error: 'Files up to 2 GB.' });
      let p = `storyboard/${kind}/${name}`; if (await exists(ws, p)) p = `storyboard/${kind}/${Date.now().toString(36)}-${name}`;
      await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: inside(ws, p), Body: req, ContentLength: size, ContentType: req.headers['content-type'] || undefined }));
      signedCall({ action: 'connector_log', workspace_id: ws.workspace_id, name, storage_path: p, size_bytes: size, content_type: req.headers['content-type'] || '' }).catch(() => {});
      return send(200, { saved: p, kind });
    }
    return send(404, { error: 'Unknown studio request.' });
  } catch (e) { return send(400, { error: String(e.message || e) }); }
}

// ---------- HTTP ----------
http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/health') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ ok: true, running: running ? running.kind : null, queued: queue.length })); }
  if (u.pathname === '/api/studio' || u.pathname.startsWith('/api/studio/')) return studioApi(req, res, u);
  const b = u.pathname.match(/^\/board\/(bbx_[A-Za-z0-9_-]+)\/?$/);
  if (b) {
    let w = null; try { w = await workspaceFor(b[1]); } catch { w = null; }
    if (!w) { res.writeHead(401, { 'content-type': 'text/plain' }); return res.end('This board link is not valid any more.'); }
    try { const html = await boardPage(w); res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer', 'x-robots-tag': 'noindex' }); return res.end(html); }
    catch (e) { log('board error', e.message); res.writeHead(500); return res.end('Board could not load.'); }
  }
  const m = u.pathname.match(/^\/mcp(?:\/(bbx_[A-Za-z0-9_-]+))?\/?$/);
  if (!m) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('BizBox connector. Use /mcp with your workspace key.'); }
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  let ws = null; try { ws = await workspaceFor(m[1] || bearer); } catch (e) { log('auth error', e.message); }
  if (!ws) { res.writeHead(401, { 'content-type': 'application/json', 'www-authenticate': 'Bearer' }); return res.end(JSON.stringify({ error: 'Workspace key missing or not valid. Make one at https://biz-box.io/workspace' })); }
  let body; if (req.method === 'POST') { let raw = ''; for await (const c of req) { raw += c; if (raw.length > 4e6) { res.writeHead(413); return res.end(); } } try { body = JSON.parse(raw); } catch { res.writeHead(400); return res.end(); } }
  const server = serverFor({ ...ws, _key: m[1] || bearer });
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on('close', () => { transport.close(); server.close(); });
  try { await server.connect(transport); await transport.handleRequest(req, res, body); }
  catch (e) { log('mcp error', e.message); if (!res.headersSent) { res.writeHead(500); res.end(); } }
}).listen(PORT, () => log('BizBox connector on :' + PORT));
