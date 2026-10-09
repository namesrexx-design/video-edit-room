// YouTube adapter for the LYFE scheduler (API mode).
//
// Written 2026-09-20 to the brief in bizbox docs/social/CLOUD-CODE-SOCIAL-SCHEDULER-RUNBOOK.md:
// OAuth refresh token, resumable upload, private by default, YouTube's own publishAt for a scheduled
// release, and a receipt only after the platform confirms the video exists.
//
// 🔴 Rules that do not bend (same as server.mjs):
//   1. Nothing goes public that was not approved first. A private draft may be uploaded from a
//      `draft` post (nobody can see it); anything with a release time needs status `approved`.
//   2. No passwords and no cookies here. Tokens come from the environment (.env, never git):
//        YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN
//   3. A timeout or dropped connection is `unknown`, never `failed`. It is reconciled by the
//      upload session, never blindly retried, so a video is not uploaded twice.
//   4. AI disclosure must be stated on the post (`ai_generated: true|false`). No default.
//
// YouTube limits worth knowing: an API project that has not passed YouTube's audit can only create
// private videos; uploads are ~1,600 quota units each (default daily quota is 10,000); publishAt
// requires the video to stay private until that moment.
import { createReadStream, statSync, existsSync } from 'node:fs';
import { resolve, sep, extname } from 'node:path';

export const TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const UPLOAD_URL = 'https://www.googleapis.com/upload/youtube/v3/videos';
export const API_URL = 'https://www.googleapis.com/youtube/v3';
const VIDEO_TYPES = { '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm' };

/** Check a post is safe to send. Returns { ok, errors, filePath, contentType, release }. */
export function validate(post, { mediaRoot = '/data/media', now = Date.now(), forPrivateDraft = false } = {}) {
  const errors = [];
  if (!post || post.platform !== 'youtube') errors.push('post is not a youtube post');
  const title = String(post?.title || '').trim();
  if (!title) errors.push('title is empty');
  if (title.length > 100) errors.push('title is over 100 characters');
  if (String(post?.caption || '').length > 5000) errors.push('caption is over 5000 characters');
  if (typeof post?.ai_generated !== 'boolean') errors.push('ai_generated must be set true or false (no default)');
  if (post?.result?.nativeId) errors.push(`already submitted as ${post.result.nativeId}`);

  let release = null;
  if (post?.scheduled_at) {
    const t = Date.parse(post.scheduled_at);
    if (Number.isNaN(t)) errors.push('scheduled_at is not a valid ISO time');
    else if (t <= now + 60_000) errors.push('scheduled_at must be at least a minute in the future');
    else release = new Date(t).toISOString();
    if (post.status !== 'approved') errors.push('a post with a release time must be approved first');
  } else if (!forPrivateDraft) {
    errors.push('no scheduled_at: only a private draft can be uploaded without a release time (use private-draft mode)');
  }
  if (forPrivateDraft && release) errors.push('private-draft mode cannot carry a release time');

  let filePath = null; let contentType = null;
  if (!post?.asset) errors.push('no asset');
  else {
    const root = resolve(mediaRoot);
    const want = resolve(root, String(post.asset).replace(/^[/\\]+/, ''));
    if (!want.startsWith(root + sep)) errors.push('asset path escapes the media folder');
    else if (!existsSync(want) || !statSync(want).isFile() || statSync(want).size === 0) errors.push(`asset missing or empty: ${post.asset}`);
    else {
      filePath = want; contentType = VIDEO_TYPES[extname(want).toLowerCase()] || null;
      if (!contentType) errors.push(`unsupported video type ${extname(want)}`);
    }
  }
  return { ok: errors.length === 0, errors, filePath, contentType, release };
}

/** Exchange the long-lived refresh token for a short-lived access token. */
export async function accessToken(env = process.env, fetchImpl = fetch) {
  for (const k of ['YT_CLIENT_ID', 'YT_CLIENT_SECRET', 'YT_REFRESH_TOKEN']) if (!env[k]) throw new Error(`missing ${k} in the environment`);
  const r = await fetchImpl(TOKEN_URL, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env.YT_CLIENT_ID, client_secret: env.YT_CLIENT_SECRET, refresh_token: env.YT_REFRESH_TOKEN, grant_type: 'refresh_token' }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(`token refresh failed (${r.status}): ${j.error || 'no access_token'}`);
  return j.access_token;
}

/**
 * Upload one post. `privateDraft` uploads a private video with no release time.
 * Otherwise the video is private with status.publishAt = scheduled_at, which is YouTube's own schedule.
 * Returns a receipt { outcome: 'dry-run'|'submitted'|'unknown'|'refused', ... }; it does not throw for
 * expected refusals so the caller can record them.
 */
export async function publish(post, opts = {}) {
  const { env = process.env, mediaRoot = process.env.SCHEDULER_MEDIA || '/data/media', fetchImpl = fetch, dryRun = false, privateDraft = false, now = Date.now } = opts;
  const v = validate(post, { mediaRoot, now: now(), forPrivateDraft: privateDraft });
  if (!v.ok) return { outcome: 'refused', errors: v.errors };

  const size = statSync(v.filePath).size;
  const body = {
    snippet: { title: String(post.title).trim(), description: String(post.caption || ''), categoryId: '22' },
    status: { privacyStatus: 'private', selfDeclaredMadeForKids: false, containsSyntheticMedia: post.ai_generated === true },
  };
  if (v.release) body.status.publishAt = v.release;
  const plan = { mode: v.release ? 'native-scheduled' : 'native-private-draft', title: body.snippet.title, bytes: size, contentType: v.contentType, privacyStatus: 'private', publishAt: v.release, containsSyntheticMedia: body.status.containsSyntheticMedia };
  if (dryRun) return { outcome: 'dry-run', plan };

  const token = await accessToken(env, fetchImpl);
  const auth = { authorization: `Bearer ${token}` };

  // 1. open a resumable session (nothing is uploaded yet, so a failure here is safe to retry)
  const init = await fetchImpl(`${UPLOAD_URL}?uploadType=resumable&part=snippet,status`, {
    method: 'POST',
    headers: { ...auth, 'content-type': 'application/json; charset=UTF-8', 'x-upload-content-length': String(size), 'x-upload-content-type': v.contentType },
    body: JSON.stringify(body),
  });
  const sessionUrl = init.headers.get('location');
  if (!init.ok || !sessionUrl) {
    const j = await init.json().catch(() => ({}));
    return { outcome: 'refused', errors: [`could not open upload session (${init.status}): ${j.error?.message || j.error || 'no location header'}`], retrySafe: true };
  }

  // 2. send the bytes. After this point a dropped connection means the outcome is unknown.
  let put;
  try {
    put = await fetchImpl(sessionUrl, { method: 'PUT', headers: { 'content-type': v.contentType, 'content-length': String(size) }, body: createReadStream(v.filePath), duplex: 'half' });
  } catch (e) {
    return { outcome: 'unknown', sessionUrl, plan, note: `upload connection failed (${e.message}); reconcile by session before any retry` };
  }
  const j = await put.json().catch(() => ({}));
  if (!put.ok || !j.id) return { outcome: 'unknown', sessionUrl, plan, note: `upload response ${put.status} had no video id; reconcile by session before any retry` };

  // 3. confirm YouTube has it, and how it is set. Only now is there a receipt.
  const check = await fetchImpl(`${API_URL}/videos?part=status,snippet,processingDetails&id=${encodeURIComponent(j.id)}`, { headers: auth });
  const cj = await check.json().catch(() => ({}));
  const item = cj.items?.[0];
  if (!check.ok || !item) return { outcome: 'unknown', nativeId: j.id, sessionUrl, plan, note: 'upload accepted but the verification read failed; reconcile by video id' };
  const st = item.status || {};
  return {
    outcome: 'submitted', mode: plan.mode, nativeId: j.id, nativeUrl: `https://youtu.be/${j.id}`,
    privacyStatus: st.privacyStatus, publishAt: st.publishAt || null, uploadStatus: st.uploadStatus,
    processing: item.processingDetails?.processingStatus || null, containsSyntheticMedia: st.containsSyntheticMedia ?? null,
    verifiedAt: new Date(now()).toISOString(), limitations: ['private until publishAt or until the owner publishes it in YouTube Studio', 'a project that has not passed the YouTube API audit stays private'],
  };
}

/** Read one video's current state by id, for reconciling an `unknown` outcome or a scheduled release. */
export async function status(nativeId, { env = process.env, fetchImpl = fetch } = {}) {
  const token = await accessToken(env, fetchImpl);
  const r = await fetchImpl(`${API_URL}/videos?part=status,snippet,processingDetails&id=${encodeURIComponent(nativeId)}`, { headers: { authorization: `Bearer ${token}` } });
  const j = await r.json().catch(() => ({}));
  return r.ok && j.items?.[0] ? { found: true, ...j.items[0] } : { found: false, http: r.status };
}
