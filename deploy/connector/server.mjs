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
    const blob = await removeBackground(new Blob([fs.readFileSync(png)], { type: 'image/png' }), { model: 'medium', output: { format: 'image/png' } });
    fs.writeFileSync(outF, Buffer.from(await blob.arrayBuffer()));
    const dest = output || src.replace(/\.[^./]+$/, '') + '-CUTOUT.png';
    job.log.push('saving'); return { saved: await upload(job.ws, dest, outF, 'image/png') };
  },
};

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

  s.registerTool('start_job', { title: 'Start a job', description: 'Ask the BizBox server to process a file in this workspace. convert_video: any video to a 1080p MP4. remove_background: a photo to a transparent PNG cutout. Returns a job id; check it with job_status.', inputSchema: { kind: z.enum(['convert_video', 'remove_background']), path: z.string().describe('Source file inside the workspace'), output: z.string().optional().describe('Where to save the result (optional)'), fps: z.number().int().min(12).max(60).optional() } },
    safe(async ({ kind, path: p, output, fps }) => { inside(ws, p); if (output) inside(ws, output); return text(jobView(addJob(ws, kind, { path: p, output, fps }))); }));

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

// ---------- HTTP ----------
http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/health') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ ok: true, running: running ? running.kind : null, queued: queue.length })); }
  const m = u.pathname.match(/^\/mcp(?:\/(bbx_[A-Za-z0-9_-]+))?\/?$/);
  if (!m) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('BizBox connector. Use /mcp with your workspace key.'); }
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  let ws = null; try { ws = await workspaceFor(m[1] || bearer); } catch (e) { log('auth error', e.message); }
  if (!ws) { res.writeHead(401, { 'content-type': 'application/json', 'www-authenticate': 'Bearer' }); return res.end(JSON.stringify({ error: 'Workspace key missing or not valid. Make one at https://app.biz-box.io/workspace' })); }
  let body; if (req.method === 'POST') { let raw = ''; for await (const c of req) { raw += c; if (raw.length > 4e6) { res.writeHead(413); return res.end(); } } try { body = JSON.parse(raw); } catch { res.writeHead(400); return res.end(); } }
  const server = serverFor(ws);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on('close', () => { transport.close(); server.close(); });
  try { await server.connect(transport); await transport.handleRequest(req, res, body); }
  catch (e) { log('mcp error', e.message); if (!res.headersSent) { res.writeHead(500); res.end(); } }
}).listen(PORT, () => log('BizBox connector on :' + PORT));
