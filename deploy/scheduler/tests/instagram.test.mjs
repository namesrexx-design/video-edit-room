import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validate, publish, whoami } from '../adapters/instagram.mjs';

const root = mkdtempSync(join(tmpdir(), 'ig-'));
writeFileSync(join(root, 'reel.mp4'), Buffer.from('not really a video'));
const env = { IG_ACCESS_TOKEN: 'tok', IG_USER_ID: '178414' };
const base = (o = {}) => ({ id: 'p1', platform: 'instagram', title: 'SN-02', caption: 'Numbers keep showing up.', asset: 'reel.mp4', aspect: '9:16', ai_generated: true, status: 'approved', ...o });
let clock = 0;
const opts = (o = {}) => ({ env, mediaRoot: root, publicUrl: async () => 'https://r2.example/x.mp4?sig=1', sleep: async () => {}, now: () => (clock += 1000), ...o });

function scripted(steps) {
  const calls = [];
  const f = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    const s = steps.shift();
    if (!s) throw new Error('unexpected extra call ' + url);
    if (s instanceof Error) throw s;
    return { ok: s.ok ?? true, status: s.status ?? 200, json: async () => s.json ?? {} };
  };
  f.calls = calls; return f;
}
const good = () => [
  { json: { id: 'CONT1' } },
  { json: { status_code: 'IN_PROGRESS' } },
  { json: { status_code: 'FINISHED' } },
  { json: { id: 'MEDIA9' } },
  { json: { permalink: 'https://www.instagram.com/reel/ABC/', media_type: 'VIDEO', timestamp: '2026-09-21T17:00:00+0000' } },
];

test('validate: instagram is public at once, so it must be approved; AI flag is required', () => {
  assert.equal(validate(base(), { mediaRoot: root }).ok, true);
  assert.match(validate(base({ status: 'draft' }), { mediaRoot: root }).errors.join(), /approved first/);
  assert.match(validate(base({ ai_generated: undefined }), { mediaRoot: root }).errors.join(), /ai_generated/);
  assert.match(validate(base({ aspect: '16:9' }), { mediaRoot: root }).errors.join(), /9:16/);
  assert.match(validate(base({ caption: 'x'.repeat(2201) }), { mediaRoot: root }).errors.join(), /2200/);
  assert.match(validate(base({ asset: '../../etc/passwd' }), { mediaRoot: root }).errors.join(), /escapes|missing/);
  assert.match(validate(base({ result: { nativeId: 'M' } }), { mediaRoot: root }).errors.join(), /already submitted/);
  assert.match(validate(base({ platform: 'youtube' }), { mediaRoot: root }).errors.join(), /not an instagram/);
});

test('dry run sends nothing and says it will be public', async () => {
  const f = scripted([]);
  const r = await publish(base(), opts({ fetchImpl: f, dryRun: true }));
  assert.equal(r.outcome, 'dry-run'); assert.equal(f.calls.length, 0); assert.equal(r.plan.willBePublic, true); assert.equal(r.plan.is_ai_generated, true);
});

test('happy path: container, poll until FINISHED, publish, confirm permalink', async () => {
  const f = scripted(good());
  const r = await publish(base(), opts({ fetchImpl: f }));
  assert.equal(r.outcome, 'submitted'); assert.equal(r.nativeId, 'MEDIA9'); assert.equal(r.nativeUrl, 'https://www.instagram.com/reel/ABC/'); assert.equal(r.mode, 'worker-timed');
  const c = f.calls[0]; assert.equal(c.url, 'https://graph.instagram.com/v25.0/178414/media');
  const body = new URLSearchParams(c.init.body);
  assert.equal(body.get('media_type'), 'REELS'); assert.equal(body.get('video_url'), 'https://r2.example/x.mp4?sig=1'); assert.equal(body.get('is_ai_generated'), 'true'); assert.equal(body.get('access_token'), 'tok');
  assert.match(f.calls[1].url, /CONT1\?fields=status_code/);
  assert.equal(f.calls[3].url, 'https://graph.instagram.com/v25.0/178414/media_publish');
  assert.equal(new URLSearchParams(f.calls[3].init.body).get('creation_id'), 'CONT1');
});

test('refuses without publishing when not approved, and without a public url', async () => {
  const f = scripted([]);
  assert.equal((await publish(base({ status: 'draft' }), opts({ fetchImpl: f }))).outcome, 'refused');
  assert.match((await publish(base(), opts({ fetchImpl: f, publicUrl: undefined }))).errors[0], /public link/);
  assert.equal(f.calls.length, 0);
});

test('Meta rejecting the video is failed, safe to retry, and nothing was published', async () => {
  const f = scripted([{ json: { id: 'C2' } }, { json: { status_code: 'ERROR' } }]);
  const r = await publish(base(), opts({ fetchImpl: f }));
  assert.equal(r.outcome, 'failed'); assert.equal(r.retrySafe, true); assert.equal(f.calls.length, 2);
});

test('a dropped connection on publish is unknown, keeping the container id', async () => {
  const f = scripted([{ json: { id: 'C3' } }, { json: { status_code: 'FINISHED' } }, new Error('ECONNRESET')]);
  const r = await publish(base(), opts({ fetchImpl: f }));
  assert.equal(r.outcome, 'unknown'); assert.equal(r.creationId, 'C3'); assert.match(r.note, /reconcile/);
});

test('published but the confirmation read fails is unknown with the media id', async () => {
  const f = scripted([{ json: { id: 'C4' } }, { json: { status_code: 'FINISHED' } }, { json: { id: 'M4' } }, { ok: false, status: 500, json: {} }]);
  const r = await publish(base(), opts({ fetchImpl: f }));
  assert.equal(r.outcome, 'unknown'); assert.equal(r.nativeId, 'M4');
});

test('still processing at the time limit is unknown, not failed', async () => {
  const steps = [{ json: { id: 'C5' } }]; for (let i = 0; i < 400; i++) steps.push({ json: { status_code: 'IN_PROGRESS' } });
  const r = await publish(base(), opts({ fetchImpl: scripted(steps), pollMaxMs: 5000 }));
  assert.equal(r.outcome, 'unknown'); assert.equal(r.creationId, 'C5');
});

test('missing token is a refusal; whoami reads the account', async () => {
  assert.match((await publish(base(), opts({ env: {}, fetchImpl: scripted([]) }))).errors[0], /IG_ACCESS_TOKEN/);
  const w = await whoami({ env, fetchImpl: scripted([{ json: { user_id: '1', username: 'rexx', account_type: 'BUSINESS' } }]) });
  assert.equal(w.username, 'rexx');
});
