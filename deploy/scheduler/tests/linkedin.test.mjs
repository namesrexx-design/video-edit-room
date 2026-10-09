import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validate, publish } from '../adapters/linkedin.mjs';

const root = mkdtempSync(join(tmpdir(), 'li-'));
writeFileSync(join(root, 'v.mp4'), Buffer.alloc(100 * 1024, 7));
const env = { LI_ACCESS_TOKEN: 'tok', LI_AUTHOR_URN: 'urn:li:person:abc' };
const base = (o = {}) => ({ id: 'p1', platform: 'linkedin', title: 'SN-02', caption: 'Numbers keep showing up. AI-generated.', asset: 'v.mp4', ai_generated: true, status: 'approved', ...o });
const opts = (o = {}) => ({ env, mediaRoot: root, sleep: async () => {}, ...o });
const H = (h = {}) => ({ get: (k) => h[k.toLowerCase()] ?? null });

function scripted(steps) {
  const calls = [];
  const f = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    const s = steps.shift(); if (!s) throw new Error('unexpected extra call ' + url);
    if (s instanceof Error) throw s;
    return { ok: s.ok ?? (s.status ?? 200) < 400, status: s.status ?? 200, headers: H(s.headers), json: async () => s.json ?? {} };
  };
  f.calls = calls; return f;
}
const good = () => [
  { json: { value: { video: 'urn:li:video:V1', uploadToken: 'T', uploadInstructions: [{ firstByte: 0, lastByte: 51199, uploadUrl: 'https://up/1' }, { firstByte: 51200, lastByte: 102399, uploadUrl: 'https://up/2' }] } } },
  { headers: { etag: '"e1"' } }, { headers: { etag: '"e2"' } },
  { status: 200 },
  { json: { status: 'PROCESSING' } }, { json: { status: 'AVAILABLE' } },
  { status: 201, headers: { 'x-restli-id': 'urn:li:share:99' } },
];

test('validate: public at once so approved only; AI flag required; mp4 size window', () => {
  assert.equal(validate(base(), { mediaRoot: root }).ok, true);
  assert.match(validate(base({ status: 'draft' }), { mediaRoot: root }).errors.join(), /approved first/);
  assert.match(validate(base({ ai_generated: undefined }), { mediaRoot: root }).errors.join(), /ai_generated/);
  assert.match(validate(base({ asset: 'x.mov' }), { mediaRoot: root }).errors.join(), /missing|MP4/);
  assert.match(validate(base({ asset: '../../etc/passwd' }), { mediaRoot: root }).errors.join(), /escapes|missing/);
  assert.match(validate(base({ result: { nativeId: 'u' } }), { mediaRoot: root }).errors.join(), /already submitted/);
});

test('dry run sends nothing', async () => {
  const f = scripted([]); const r = await publish(base(), opts({ fetchImpl: f, dryRun: true }));
  assert.equal(r.outcome, 'dry-run'); assert.equal(f.calls.length, 0); assert.equal(r.plan.willBePublic, true);
});

test('happy path: init, two parts with etags, finalize, poll, post', async () => {
  const f = scripted(good()); const r = await publish(base(), opts({ fetchImpl: f }));
  assert.equal(r.outcome, 'submitted'); assert.equal(r.nativeId, 'urn:li:share:99'); assert.equal(r.mode, 'worker-timed');
  const init = f.calls[0]; assert.equal(init.url, 'https://api.linkedin.com/rest/videos?action=initializeUpload');
  assert.equal(init.init.headers['x-restli-protocol-version'], '2.0.0'); assert.ok(init.init.headers['linkedin-version']);
  assert.equal(JSON.parse(init.init.body).initializeUploadRequest.fileSizeBytes, 102400);
  assert.equal(f.calls[1].init.body.length, 51200); assert.equal(f.calls[1].url, 'https://up/1');
  assert.deepEqual(JSON.parse(f.calls[3].init.body).finalizeUploadRequest.uploadedPartIds, ['e1', 'e2']);
  const body = JSON.parse(f.calls[6].init.body);
  assert.equal(body.lifecycleState, 'PUBLISHED'); assert.equal(body.content.media.id, 'urn:li:video:V1'); assert.equal(body.author, 'urn:li:person:abc');
});

test('refuses without publishing when not approved or env missing', async () => {
  const f = scripted([]);
  assert.equal((await publish(base({ status: 'draft' }), opts({ fetchImpl: f }))).outcome, 'refused');
  assert.match((await publish(base(), opts({ env: {}, fetchImpl: f }))).errors[0], /LI_ACCESS_TOKEN/);
  assert.match((await publish(base(), opts({ env: { ...env, LI_AUTHOR_URN: 'bob' }, fetchImpl: f }))).errors[0], /urn:li/);
  assert.equal(f.calls.length, 0);
});

test('processing failure is failed and retry-safe', async () => {
  const s = good().slice(0, 4); s.push({ json: { status: 'PROCESSING_FAILED', processingFailureReason: 'bad codec' } });
  const r = await publish(base(), opts({ fetchImpl: scripted(s) }));
  assert.equal(r.outcome, 'failed'); assert.equal(r.retrySafe, true); assert.match(r.note, /bad codec/);
});

test('a part with no etag is failed before anything is public', async () => {
  const r = await publish(base(), opts({ fetchImpl: scripted([good()[0], { headers: {} }]) }));
  assert.equal(r.outcome, 'failed');
});

test('dropped connection creating the post is unknown, keeping the video urn', async () => {
  const s = good().slice(0, 6); s.push(new Error('ECONNRESET'));
  const r = await publish(base(), opts({ fetchImpl: scripted(s) }));
  assert.equal(r.outcome, 'unknown'); assert.equal(r.videoUrn, 'urn:li:video:V1');
});

test('5xx on post creation is unknown; 403 is failed', async () => {
  const mk = (st) => { const s = good().slice(0, 6); s.push({ status: st }); return s; };
  assert.equal((await publish(base(), opts({ fetchImpl: scripted(mk(503)) }))).outcome, 'unknown');
  assert.equal((await publish(base(), opts({ fetchImpl: scripted(mk(403)) }))).outcome, 'failed');
});

test('still processing at the time limit is unknown, not failed', async () => {
  const s = [good()[0], { headers: { etag: '"a"' } }, { headers: { etag: '"b"' } }, { status: 200 }]; for (let i = 0; i < 400; i++) s.push({ json: { status: 'PROCESSING' } });
  let t = 0; const r = await publish(base(), opts({ fetchImpl: scripted(s), pollMaxMs: 5000, now: () => (t += 1000) }));
  assert.equal(r.outcome, 'unknown');
});
