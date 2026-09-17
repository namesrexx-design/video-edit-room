// The scheduler's store: one JSON file, written atomically.
//
// Why a file and not a database: this queue holds tens of posts, not millions, and a file can be
// read, diffed, backed up and fixed by hand at 2am. If it ever outgrows that, the shape below maps
// straight onto a table.
//
// A post is never "sent" by accident. It moves:
//   draft -> approved -> (due) -> ready|posted -> done
// and nothing leaves the machine unless someone approved it first.
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

const FILE = process.env.SCHEDULER_DB || '/data/scheduler/posts.json';

export const STATUSES = ['draft', 'approved', 'ready', 'posted', 'skipped', 'failed'];
export const PLATFORMS = ['tiktok', 'instagram', 'facebook', 'x', 'youtube', 'linkedin', 'snapchat', 'threads', 'pinterest', 'kick'];

function empty() { return { version: 1, posts: [], log: [] }; }

export function load() {
  try {
    if (!existsSync(FILE)) return empty();
    const db = JSON.parse(readFileSync(FILE, 'utf8'));
    if (!Array.isArray(db.posts)) return empty();
    return db;
  } catch (e) {
    // A corrupt file must never silently become an empty queue — keep it and shout.
    const bad = FILE + '.broken-' + Date.now();
    try { renameSync(FILE, bad); } catch {}
    console.error(`[scheduler] could not read ${FILE} (${e.message}); kept it at ${bad}`);
    return empty();
  }
}

export function save(db) {
  mkdirSync(dirname(FILE), { recursive: true });
  const tmp = FILE + '.tmp';
  writeFileSync(tmp, JSON.stringify(db, null, 2));
  renameSync(tmp, FILE);
  return db;
}

export function note(db, what, detail) {
  db.log.unshift({ at: new Date().toISOString(), what, detail });
  db.log = db.log.slice(0, 500);
}

/** Add a post. Everything starts as a draft; approval is a separate, deliberate act. */
export function addPost(db, p) {
  const post = {
    id: randomUUID().slice(0, 8),
    title: String(p.title || '').slice(0, 200),
    platform: String(p.platform || '').toLowerCase(),
    asset: p.asset || null,           // path under /data/media or a delivered file
    aspect: p.aspect || null,         // "9:16" | "16:9" | "1:1"
    caption: String(p.caption || ''),
    first_comment: p.first_comment ? String(p.first_comment) : '',
    scheduled_at: p.scheduled_at || null,   // ISO, in UTC
    status: 'draft',
    source: p.source || 'manual',     // e.g. "post-plan.json"
    group: p.group || null,           // clip id, so one clip's posts stay together
    result: null,
    created_at: new Date().toISOString(),
  };
  if (!PLATFORMS.includes(post.platform)) throw new Error(`unknown platform: ${post.platform}`);
  db.posts.push(post);
  note(db, 'added', `${post.platform} · ${post.title}`);
  return post;
}

export function setStatus(db, id, status, result) {
  if (!STATUSES.includes(status)) throw new Error(`unknown status: ${status}`);
  const post = db.posts.find((x) => x.id === id);
  if (!post) throw new Error(`no post ${id}`);
  post.status = status;
  if (result !== undefined) post.result = result;
  post.updated_at = new Date().toISOString();
  note(db, status, `${post.platform} · ${post.title}`);
  return post;
}

/** Approved posts whose time has come. Nothing else is ever returned here. */
export function due(db, now = Date.now()) {
  return db.posts.filter((p) => p.status === 'approved' && p.scheduled_at && Date.parse(p.scheduled_at) <= now);
}

export const dbFile = FILE;
export const mediaRoot = process.env.SCHEDULER_MEDIA || '/data/media';
export const deliveriesRoot = join(process.env.SCHEDULER_REPO || '/repo', 'projects');
