// Instagram Reels adapter for the LYFE scheduler (API mode), "Instagram API with Instagram Login".
//
// Written 2026-09-20 to the brief in bizbox docs/social/CLOUD-CODE-SOCIAL-SCHEDULER-RUNBOOK.md.
// Facts below were read from Meta's docs the same day (developers.facebook.com/docs/instagram-platform/
// content-publishing and .../instagram-api-with-instagram-login/content-publishing):
//   • host graph.instagram.com; container POST /<IG_ID>/media (media_type=REELS, video_url, caption,
//     is_ai_generated); status GET /<CONTAINER_ID>?fields=status_code (EXPIRED|ERROR|FINISHED|
//     IN_PROGRESS|PUBLISHED); publish POST /<IG_ID>/media_publish (creation_id).
//   • Meta cURLs the video, so the video_url must be publicly reachable. Ours sits behind a password,
//     so a short-lived link is made per upload (r2-link.mjs) and passed in as `publicUrl`.
//   • 100 API-published posts per 24 h. Dashboard tokens last 60 days.
//   • There is NO future-scheduling field in what was read: this adapter publishes NOW. The scheduler
//     must call it at the due time and label the receipt `worker-timed`, never `native-scheduled`.
//
// 🔴 Rules that do not bend (same as server.mjs and youtube.mjs):
//   1. Instagram has no private draft: a successful publish is PUBLIC. So the post must be `approved`.
//   2. No passwords/cookies. Token and account id come from the environment (.env, never git):
//        IG_ACCESS_TOKEN, IG_USER_ID   (optional IG_GRAPH_BASE, default https://graph.instagram.com/v25.0)
//   3. A timeout after the publish request is `unknown`, never `failed`: it is reconciled, not retried.
//   4. AI disclosure must be stated on the post (`ai_generated: true|false`); it is sent as is_ai_generated.
import { statSync, existsSync } from 'node:fs';
import { resolve, sep, extname } from 'node:path';

export const DEFAULT_BASE = 'https://graph.instagram.com/v25.0';
const VIDEO_EXT = ['.mp4', '.mov'];

export function validate(post, { mediaRoot = '/data/media' } = {}) {
  const errors = [];
  if (!post || post.platform !== 'instagram') errors.push('post is not an instagram post');
  if (post?.status !== 'approved') errors.push('instagram publishes publicly at once, so the post must be approved first');
  if (typeof post?.ai_generated !== 'boolean') errors.push('ai_generated must be set true or false (no default)');
  if (String(post?.caption || '').length > 2200) errors.push('caption is over 2200 characters');
  if (post?.result?.nativeId || post?.result?.creationId) errors.push('already submitted; reconcile by id instead of posting again');
  let filePath = null;
  if (!post?.asset) errors.push('no asset');
  else {
    const root = resolve(mediaRoot);
    const want = resolve(root, String(post.asset).replace(/^[/\\]+/, ''));
    if (!want.startsWith(root + sep)) errors.push('asset path escapes the media folder');
    else if (!existsSync(want) || !statSync(want).isFile() || statSync(want).size === 0) errors.push(`asset missing or empty: ${post.asset}`);
    else if (!VIDEO_EXT.includes(extname(want).toLowerCase())) errors.push(`unsupported video type ${extname(want)}`);
    else filePath = want;
  }
  if (post?.aspect && post.aspect !== '9:16') errors.push(`reels are 9:16; this post says ${post.aspect}`);
  return { ok: errors.length === 0, errors, filePath };
}

const form = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, String(v)]));

/**
 * Publish one Reel. `publicUrl(post, filePath)` must return a link Meta can download.
 * Returns { outcome: 'dry-run'|'submitted'|'unknown'|'refused'|'failed', ... } and never throws for expected outcomes.
 */
export async function publish(post, opts = {}) {
  const { env = process.env, mediaRoot = process.env.SCHEDULER_MEDIA || '/data/media', fetchImpl = fetch, dryRun = false, publicUrl, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), pollEveryMs = 5000, pollMaxMs = 300_000, now = Date.now } = opts;
  const v = validate(post, { mediaRoot });
  if (!v.ok) return { outcome: 'refused', errors: v.errors };
  for (const k of ['IG_ACCESS_TOKEN', 'IG_USER_ID']) if (!env[k]) return { outcome: 'refused', errors: [`missing ${k} in the environment`] };
  const base = env.IG_GRAPH_BASE || DEFAULT_BASE; const uid = env.IG_USER_ID; const token = env.IG_ACCESS_TOKEN;
  const plan = { mode: 'worker-timed', mediaType: 'REELS', bytes: statSync(v.filePath).size, is_ai_generated: post.ai_generated === true, captionLength: String(post.caption || '').length, willBePublic: true };
  if (dryRun) return { outcome: 'dry-run', plan };
  if (typeof publicUrl !== 'function') return { outcome: 'refused', errors: ['no publicUrl function: Meta needs a public link to the video'] };

  const url = await publicUrl(post, v.filePath);
  // 1. container (nothing is public yet; safe to retry if this step fails)
  const c = await fetchImpl(`${base}/${uid}/media`, { method: 'POST', body: form({ media_type: 'REELS', video_url: url, caption: post.caption || '', is_ai_generated: post.ai_generated === true, access_token: token }) });
  const cj = await c.json().catch(() => ({}));
  if (!c.ok || !cj.id) return { outcome: 'refused', retrySafe: true, errors: [`container not created (${c.status}): ${cj.error?.message || 'no id'}`] };
  const creationId = cj.id;

  // 2. wait for Meta to finish processing the video
  const t0 = now(); let code = 'IN_PROGRESS';
  while (code === 'IN_PROGRESS' && now() - t0 < pollMaxMs) {
    await sleep(pollEveryMs);
    const s = await fetchImpl(`${base}/${creationId}?fields=status_code&access_token=${encodeURIComponent(token)}`);
    const sj = await s.json().catch(() => ({})); code = sj.status_code || 'IN_PROGRESS';
  }
  if (code === 'ERROR' || code === 'EXPIRED') return { outcome: 'failed', creationId, statusCode: code, retrySafe: true, note: 'Meta rejected the video before publishing; nothing is public' };
  if (code !== 'FINISHED') return { outcome: 'unknown', creationId, statusCode: code, note: 'still processing at the time limit; check the container before publishing' };

  // 3. publish. From here on a dropped connection means the outcome is unknown.
  let p;
  try { p = await fetchImpl(`${base}/${uid}/media_publish`, { method: 'POST', body: form({ creation_id: creationId, access_token: token }) }); }
  catch (e) { return { outcome: 'unknown', creationId, note: `publish connection failed (${e.message}); reconcile against the account's recent media before any retry` }; }
  const pj = await p.json().catch(() => ({}));
  if (!p.ok || !pj.id) return { outcome: 'unknown', creationId, note: `publish response ${p.status} had no media id: ${pj.error?.message || ''}; reconcile before any retry` };

  // 4. confirm and record the public link
  const g = await fetchImpl(`${base}/${pj.id}?fields=permalink,media_type,timestamp&access_token=${encodeURIComponent(token)}`);
  const gj = await g.json().catch(() => ({}));
  if (!g.ok || !gj.permalink) return { outcome: 'unknown', nativeId: pj.id, creationId, note: 'published but the confirmation read failed; reconcile by media id' };
  return { outcome: 'submitted', mode: 'worker-timed', nativeId: pj.id, nativeUrl: gj.permalink, mediaType: gj.media_type, timestamp: gj.timestamp, creationId, is_ai_generated: plan.is_ai_generated, verifiedAt: new Date(now()).toISOString(), limitations: ['published publicly at dispatch time; Instagram exposes no future-scheduling field here', '100 API-published posts per 24 hours', 'the dashboard token lasts 60 days'] };
}

/** Read the account behind the token, for a safe connectivity check that changes nothing. */
export async function whoami({ env = process.env, fetchImpl = fetch } = {}) {
  const base = env.IG_GRAPH_BASE || DEFAULT_BASE;
  const r = await fetchImpl(`${base}/me?fields=user_id,username,account_type&access_token=${encodeURIComponent(env.IG_ACCESS_TOKEN || '')}`);
  const j = await r.json().catch(() => ({}));
  return { http: r.status, ...(r.ok ? j : { error: j.error?.message || 'request failed' }) };
}
