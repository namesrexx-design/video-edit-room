// Telegram handoff: when a post becomes `ready` (a platform the scheduler cannot post itself), send Rexx
// the finished pack: the video, the caption, and two buttons. He saves the video, posts it in the app
// (two taps), then presses "Posted" and the board records it. Nothing is ever posted by this file.
//
// Env (server .env, never git, never chat): TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID. Both empty = feature off.
// Facts from Telegram's Bot API docs: sendVideo/sendMessage POST to https://api.telegram.org/bot<TOKEN>/<method>;
// a bot may upload a file up to 50 MB by multipart; callback buttons come back through getUpdates.
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, sep, basename } from 'node:path';
import { load, save, setStatus } from './store.mjs';

const API = (env) => `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`;
export const enabled = (env = process.env) => Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID);
const MAX = 50 * 1024 * 1024;

const label = (p) => ({ tiktok: 'TikTok', instagram: 'Instagram', facebook: 'Facebook', x: 'X', threads: 'Threads', linkedin: 'LinkedIn', youtube: 'YouTube', snapchat: 'Snapchat', pinterest: 'Pinterest' }[p] || p);

export function pack(post) {
  const ai = post.ai_generated === true ? '\n\n⚠️ Turn the AI-generated label ON.' : '';
  return `📣 ${label(post.platform)} — ${post.title}\n\n${post.caption || ''}${ai}`.slice(0, 1024);
}

/** Send one post's pack. Returns { sent, note }. Never throws. */
export async function sendPack(post, { env = process.env, fetchImpl = fetch, mediaRoot = process.env.SCHEDULER_MEDIA || '/data/media' } = {}) {
  if (!enabled(env)) return { sent: false, note: 'telegram not configured' };
  const keyboard = { inline_keyboard: [[{ text: '✅ Posted', callback_data: `posted:${post.id}` }, { text: '⏭ Skip', callback_data: `skip:${post.id}` }]] };
  try {
    let file = null;
    if (post.asset) {
      const root = resolve(mediaRoot); const want = resolve(root, String(post.asset).replace(/^[/\\]+/, ''));
      if (want.startsWith(root + sep) && existsSync(want) && statSync(want).isFile() && statSync(want).size <= MAX) file = want;
    }
    let res;
    if (file) {
      const fd = new FormData();
      fd.append('chat_id', env.TELEGRAM_CHAT_ID); fd.append('caption', pack(post)); fd.append('supports_streaming', 'true'); fd.append('reply_markup', JSON.stringify(keyboard));
      fd.append('video', new Blob([readFileSync(file)], { type: 'video/mp4' }), basename(file));
      res = await fetchImpl(`${API(env)}/sendVideo`, { method: 'POST', body: fd });
    } else {
      res = await fetchImpl(`${API(env)}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: pack(post) + (post.asset ? '\n\n(video too large or missing on the server)' : ''), reply_markup: keyboard }) });
    }
    const j = await res.json().catch(() => ({}));
    return res.ok && j.ok ? { sent: true, withVideo: Boolean(file), messageId: j.result?.message_id } : { sent: false, note: `telegram ${res.status}: ${j.description || 'no detail'}` };
  } catch (e) { return { sent: false, note: `telegram error: ${e.message}` }; }
}

/** Send a pack once per post; remember it on the post so a restart never re-sends. */
export async function notifyReady(posts, opts = {}) {
  for (const p of posts) {
    const r = await sendPack(p, opts);
    const db = load(); const cur = db.posts.find((x) => x.id === p.id);
    if (cur) { cur.result = { ...(cur.result || {}), telegram: { ...r, at: new Date().toISOString() } }; save(db); }
  }
}

/** Apply button presses. Only a `ready` post can be marked; anything else is ignored. */
export function applyCallback(data, { load: ld = load, save: sv = save } = {}) {
  const m = /^(posted|skip):(.+)$/.exec(data || ''); if (!m) return null;
  const db = ld(); const p = db.posts.find((x) => x.id === m[2]);
  if (!p || p.status !== 'ready') return { ignored: true };
  setStatus(db, p.id, m[1] === 'posted' ? 'posted' : 'skipped', { ...(p.result || {}), markedVia: 'telegram', markedAt: new Date().toISOString() });
  sv(db); return { id: p.id, status: m[1] === 'posted' ? 'posted' : 'skipped' };
}

let offset = 0;
export async function pollButtons({ env = process.env, fetchImpl = fetch } = {}) {
  if (!enabled(env)) return 0;
  const r = await fetchImpl(`${API(env)}/getUpdates?timeout=0&offset=${offset}`); const j = await r.json().catch(() => ({}));
  let n = 0;
  for (const u of j.result || []) {
    offset = u.update_id + 1;
    const cq = u.callback_query; if (!cq || String(cq.message?.chat?.id) !== String(env.TELEGRAM_CHAT_ID)) continue;   // only Rexx's chat
    const out = applyCallback(cq.data);
    await fetchImpl(`${API(env)}/answerCallbackQuery`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ callback_query_id: cq.id, text: out?.status ? `Marked ${out.status}` : 'Nothing to change' }) }).catch(() => {});
    n++;
  }
  return n;
}
