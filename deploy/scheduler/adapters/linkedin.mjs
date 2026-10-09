// LinkedIn video post adapter for the LYFE scheduler (API mode).
//
// Written 2026-09-20 from LinkedIn's own docs read the same day (learn.microsoft.com/linkedin/marketing/
// community-management/shares/videos-api and .../posts-api):
//   • every call needs headers Linkedin-Version: YYYYMM and X-Restli-Protocol-Version: 2.0.0
//   • POST /rest/videos?action=initializeUpload {initializeUploadRequest:{owner,fileSizeBytes,...}}
//       -> value.video (urn:li:video:...), value.uploadInstructions[{firstByte,lastByte,uploadUrl}], value.uploadToken
//   • PUT each byte range to its uploadUrl (Content-Type application/octet-stream); keep each response ETag
//   • POST /rest/videos?action=finalizeUpload {finalizeUploadRequest:{video,uploadToken,uploadedPartIds:[etags in order]}}
//   • GET /rest/videos/<urn-encoded> until status AVAILABLE (PROCESSING_FAILED = rejected)
//   • POST /rest/posts {author,commentary,visibility:PUBLIC,distribution:{feedDistribution:MAIN_FEED,...},
//       content:{media:{title,id}},lifecycleState:PUBLISHED,isReshareDisabledByAuthor:false} -> 201, header x-restli-id
//   • video: MP4, 3 s to 30 min, 75 KB to 500 MB. Scopes: w_member_social (person) / w_organization_social (page).
//   • lifecycleState PUBLISHED is the only value accepted at creation: NO scheduling and NO private draft. This adapter
//     publishes NOW, so the scheduler must call it at the due time and the receipt says `worker-timed`.
//
// NOT in the docs read (do not assume): which LinkedIn product/approval gives an app w_member_social or
// w_organization_social, token lifetime/refresh, any AI-disclosure field, the current valid Linkedin-Version value
// (the docs list monikers through 2026-09; default here is 202609 and can be overridden with LI_VERSION).
//
// 🔴 Same rules as the other adapters:
//   1. A successful post is PUBLIC, so the post must be `approved`.
//   2. No passwords/cookies. Env only (.env, never git): LI_ACCESS_TOKEN, LI_AUTHOR_URN (urn:li:person:... or
//      urn:li:organization:...), optional LI_VERSION, LI_API_BASE.
//   3. A dropped connection on the post-creation call is `unknown`, never `failed`: reconcile, do not retry blindly.
import { statSync, existsSync, openSync, readSync, closeSync } from 'node:fs';
import { resolve, sep, extname } from 'node:path';

export const DEFAULT_BASE = 'https://api.linkedin.com';
const MIN_BYTES = 75 * 1024; const MAX_BYTES = 500 * 1024 * 1024;

export function validate(post, { mediaRoot = '/data/media' } = {}) {
  const errors = [];
  if (!post || post.platform !== 'linkedin') errors.push('post is not a linkedin post');
  if (post?.status !== 'approved') errors.push('linkedin publishes publicly at once, so the post must be approved first');
  if (typeof post?.ai_generated !== 'boolean') errors.push('ai_generated must be set true or false (no default); LinkedIn has no API field for it, so put the disclosure in the caption');
  if (String(post?.caption || '').length > 3000) errors.push('commentary is over 3000 characters');
  if (post?.result?.nativeId || post?.result?.videoUrn) errors.push('already submitted; reconcile by id instead of posting again');
  let filePath = null;
  if (!post?.asset) errors.push('no asset');
  else {
    const root = resolve(mediaRoot);
    const want = resolve(root, String(post.asset).replace(/^[/\\]+/, ''));
    if (!want.startsWith(root + sep)) errors.push('asset path escapes the media folder');
    else if (!existsSync(want) || !statSync(want).isFile()) errors.push(`asset missing: ${post.asset}`);
    else if (extname(want).toLowerCase() !== '.mp4') errors.push('LinkedIn video must be MP4');
    else {
      const n = statSync(want).size;
      if (n < MIN_BYTES || n > MAX_BYTES) errors.push(`video must be 75 KB to 500 MB (this is ${n} bytes)`);
      else filePath = want;
    }
  }
  return { ok: errors.length === 0, errors, filePath };
}

function readRange(path, first, last) {
  const fd = openSync(path, 'r'); const len = last - first + 1; const buf = Buffer.alloc(len);
  try { const n = readSync(fd, buf, 0, len, first); return buf.subarray(0, n); } finally { closeSync(fd); }
}

/** Returns { outcome: 'dry-run'|'submitted'|'unknown'|'refused'|'failed', ... }; never throws for expected outcomes. */
export async function publish(post, opts = {}) {
  const { env = process.env, mediaRoot = process.env.SCHEDULER_MEDIA || '/data/media', fetchImpl = fetch, dryRun = false, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), pollEveryMs = 5000, pollMaxMs = 300_000, now = Date.now } = opts;
  const v = validate(post, { mediaRoot });
  if (!v.ok) return { outcome: 'refused', errors: v.errors };
  for (const k of ['LI_ACCESS_TOKEN', 'LI_AUTHOR_URN']) if (!env[k]) return { outcome: 'refused', errors: [`missing ${k} in the environment`] };
  if (!/^urn:li:(person|organization):/.test(env.LI_AUTHOR_URN)) return { outcome: 'refused', errors: ['LI_AUTHOR_URN must be urn:li:person:... or urn:li:organization:...'] };
  const base = env.LI_API_BASE || DEFAULT_BASE; const author = env.LI_AUTHOR_URN;
  const H = { authorization: `Bearer ${env.LI_ACCESS_TOKEN}`, 'linkedin-version': env.LI_VERSION || '202609', 'x-restli-protocol-version': '2.0.0' };
  const size = statSync(v.filePath).size;
  const plan = { mode: 'worker-timed', author, bytes: size, captionLength: String(post.caption || '').length, willBePublic: true, ai_generated: post.ai_generated };
  if (dryRun) return { outcome: 'dry-run', plan };

  // 1. register the upload (nothing public; safe to retry)
  const i = await fetchImpl(`${base}/rest/videos?action=initializeUpload`, { method: 'POST', headers: { ...H, 'content-type': 'application/json' }, body: JSON.stringify({ initializeUploadRequest: { owner: author, fileSizeBytes: size, uploadCaptions: false, uploadThumbnail: false } }) });
  const ij = await i.json().catch(() => ({}));
  const val = ij.value;
  if (!i.ok || !val?.video || !Array.isArray(val.uploadInstructions) || !val.uploadInstructions.length) return { outcome: 'refused', retrySafe: true, errors: [`upload not initialised (${i.status}): ${ij.message || 'no video urn'}`] };
  const videoUrn = val.video;

  // 2. upload each byte range and keep its ETag, in order
  const etags = [];
  for (const part of val.uploadInstructions) {
    const bytes = readRange(v.filePath, part.firstByte, part.lastByte);
    const u = await fetchImpl(part.uploadUrl, { method: 'PUT', headers: { 'content-type': 'application/octet-stream' }, body: bytes });
    const tag = u.headers?.get?.('etag');
    if (!u.ok || !tag) return { outcome: 'failed', videoUrn, retrySafe: true, note: `part ${part.firstByte}-${part.lastByte} not accepted (${u.status}); nothing is public` };
    etags.push(tag.replace(/^"|"$/g, ''));
  }

  // 3. finalize, then wait until LinkedIn has processed the video
  const f = await fetchImpl(`${base}/rest/videos?action=finalizeUpload`, { method: 'POST', headers: { ...H, 'content-type': 'application/json' }, body: JSON.stringify({ finalizeUploadRequest: { video: videoUrn, uploadToken: val.uploadToken || '', uploadedPartIds: etags } }) });
  if (!f.ok) return { outcome: 'failed', videoUrn, retrySafe: true, note: `finalize rejected (${f.status}); nothing is public` };
  const t0 = now(); let status = 'PROCESSING';
  while (['PROCESSING', 'WAITING_UPLOAD'].includes(status) && now() - t0 < pollMaxMs) {
    await sleep(pollEveryMs);
    const g = await fetchImpl(`${base}/rest/videos/${encodeURIComponent(videoUrn)}`, { headers: H });
    const gj = await g.json().catch(() => ({})); status = gj.status || 'PROCESSING';
    if (status === 'PROCESSING_FAILED') return { outcome: 'failed', videoUrn, retrySafe: true, note: `LinkedIn could not process the video: ${gj.processingFailureReason || 'no reason given'}; nothing is public` };
  }
  if (status !== 'AVAILABLE') return { outcome: 'unknown', videoUrn, statusCode: status, note: 'still processing at the time limit; check the video before creating the post' };

  // 4. create the post. A dropped connection here means the outcome is unknown.
  let p;
  try {
    p = await fetchImpl(`${base}/rest/posts`, { method: 'POST', headers: { ...H, 'content-type': 'application/json' }, body: JSON.stringify({ author, commentary: post.caption || '', visibility: 'PUBLIC', distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] }, content: { media: { title: String(post.title || '').slice(0, 200), id: videoUrn } }, lifecycleState: 'PUBLISHED', isReshareDisabledByAuthor: false }) });
  } catch (e) { return { outcome: 'unknown', videoUrn, note: `post connection failed (${e.message}); check the ${author} recent posts before any retry` }; }
  const postId = p.headers?.get?.('x-restli-id');
  if (p.status !== 201 || !postId) return { outcome: p.status >= 400 && p.status < 500 && p.status !== 409 && p.status !== 429 ? 'failed' : 'unknown', videoUrn, note: `post response ${p.status}; ${p.status >= 500 || p.status === 409 ? 'reconcile before any retry' : 'LinkedIn refused it; nothing is public'}` };
  return { outcome: 'submitted', mode: 'worker-timed', nativeId: postId, nativeUrl: `https://www.linkedin.com/feed/update/${postId}/`, videoUrn, ai_generated: post.ai_generated, verifiedAt: new Date(now()).toISOString(), limitations: ['published publicly at dispatch time; LinkedIn accepts only PUBLISHED at creation, so no scheduling', 'no AI-disclosure API field found: disclosure lives in the caption'] };
}
