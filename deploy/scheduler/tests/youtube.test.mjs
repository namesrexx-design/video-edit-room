import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validate, publish, accessToken } from '../adapters/youtube.mjs';

const root = mkdtempSync(join(tmpdir(), 'yt-'));
writeFileSync(join(root, 'clip.mp4'), Buffer.from('not really a video'));
const NOW = Date.parse('2026-09-21T12:00:00Z');
const later = '2026-09-22T17:00:00Z';
const env = { YT_CLIENT_ID: 'id', YT_CLIENT_SECRET: 'secret', YT_REFRESH_TOKEN: 'refresh' };
const base = (o = {}) => ({ id: 'a1', platform: 'youtube', title: 'Drive Home', caption: 'cap', asset: 'clip.mp4', ai_generated: true, status: 'approved', scheduled_at: later, ...o });
const opts = (o = {}) => ({ env, mediaRoot: root, now: () => NOW, ...o });

// A scripted fetch: each entry answers the next call and records what it was asked.
function scripted(steps) {
  const calls = [];
  const f = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    const step = steps.shift();
    if (!step) throw new Error('unexpected extra call ' + url);
    if (step instanceof Error) throw step;
    return { ok: step.ok ?? true, status: step.status ?? 200, headers: { get: (k) => (step.headers || {})[k.toLowerCase()] ?? null }, json: async () => step.json ?? {} };
  };
  f.calls = calls; return f;
}
const okSteps = (extra = {}) => [
  { json: { access_token: 'tok' } },
  { headers: { location: 'https://upload.example/session1' } },
  { json: { id: 'VID123' } },
  { json: { items: [{ status: { privacyStatus: 'private', uploadStatus: 'uploaded', ...extra }, processingDetails: { processingStatus: 'processing' } }] } },
];

test('validate passes a good scheduled post and rejects the bad ones', () => {
  assert.equal(validate(base(), { mediaRoot: root, now: NOW }).ok, true);
  assert.match(validate(base({ status: 'draft' }), { mediaRoot: root, now: NOW }).errors.join(), /approved first/);
  assert.match(validate(base({ ai_generated: undefined }), { mediaRoot: root, now: NOW }).errors.join(), /ai_generated/);
  assert.match(validate(base({ scheduled_at: '2026-09-21T12:00:30Z' }), { mediaRoot: root, now: NOW }).errors.join(), /minute in the future/);
  assert.match(validate(base({ asset: '../../etc/passwd' }), { mediaRoot: root, now: NOW }).errors.join(), /escapes|missing/);
  assert.match(validate(base({ title: 'x'.repeat(101) }), { mediaRoot: root, now: NOW }).errors.join(), /100/);
  assert.match(validate(base({ platform: 'tiktok' }), { mediaRoot: root, now: NOW }).errors.join(), /not a youtube/);
  assert.match(validate(base({ result: { nativeId: 'X' } }), { mediaRoot: root, now: NOW }).errors.join(), /already submitted/);
});

test('an unscheduled post can only be a private draft', () => {
  assert.match(validate(base({ scheduled_at: null }), { mediaRoot: root, now: NOW }).errors.join(), /private draft/);
  const d = validate(base({ scheduled_at: null, status: 'draft' }), { mediaRoot: root, now: NOW, forPrivateDraft: true });
  assert.equal(d.ok, true);
  assert.match(validate(base(), { mediaRoot: root, now: NOW, forPrivateDraft: true }).errors.join(), /cannot carry a release time/);
});

test('dry run sends nothing', async () => {
  const f = scripted([]);
  const r = await publish(base(), opts({ fetchImpl: f, dryRun: true }));
  assert.equal(r.outcome, 'dry-run'); assert.equal(f.calls.length, 0);
  assert.equal(r.plan.privacyStatus, 'private'); assert.equal(r.plan.publishAt, later.replace('Z', '.000Z'));
});

test('scheduled upload is private + publishAt and returns a verified receipt', async () => {
  const f = scripted(okSteps({ publishAt: '2026-09-22T17:00:00Z', containsSyntheticMedia: true }));
  const r = await publish(base(), opts({ fetchImpl: f }));
  assert.equal(r.outcome, 'submitted'); assert.equal(r.mode, 'native-scheduled'); assert.equal(r.nativeId, 'VID123');
  assert.equal(r.nativeUrl, 'https://youtu.be/VID123'); assert.equal(r.privacyStatus, 'private'); assert.equal(r.containsSyntheticMedia, true);
  const init = JSON.parse(f.calls[1].init.body);
  assert.equal(init.status.privacyStatus, 'private'); assert.equal(init.status.publishAt, '2026-09-22T17:00:00.000Z'); assert.equal(init.status.containsSyntheticMedia, true);
  assert.equal(f.calls[1].init.headers.authorization, 'Bearer tok');
  assert.match(f.calls[1].url, /uploadType=resumable/); assert.equal(f.calls[2].url, 'https://upload.example/session1'); assert.equal(f.calls[2].init.method, 'PUT');
});

test('private draft has no publishAt', async () => {
  const f = scripted(okSteps());
  const r = await publish(base({ scheduled_at: null, status: 'draft' }), opts({ fetchImpl: f, privateDraft: true }));
  assert.equal(r.outcome, 'submitted'); assert.equal(r.mode, 'native-private-draft');
  assert.equal('publishAt' in JSON.parse(f.calls[1].init.body).status, false);
});

test('refusals are returned, not thrown, and nothing is sent', async () => {
  const f = scripted([]);
  const r = await publish(base({ status: 'draft' }), opts({ fetchImpl: f }));
  assert.equal(r.outcome, 'refused'); assert.equal(f.calls.length, 0);
});

test('a dropped connection during the upload is unknown, never failed', async () => {
  const f = scripted([{ json: { access_token: 'tok' } }, { headers: { location: 'https://upload.example/s' } }, new Error('ECONNRESET')]);
  const r = await publish(base(), opts({ fetchImpl: f }));
  assert.equal(r.outcome, 'unknown'); assert.equal(r.sessionUrl, 'https://upload.example/s'); assert.match(r.note, /reconcile/);
});

test('upload accepted but verification fails keeps the video id as unknown', async () => {
  const f = scripted([{ json: { access_token: 'tok' } }, { headers: { location: 'https://u/s' } }, { json: { id: 'V9' } }, { ok: false, status: 500, json: {} }]);
  const r = await publish(base(), opts({ fetchImpl: f }));
  assert.equal(r.outcome, 'unknown'); assert.equal(r.nativeId, 'V9');
});

test('failing to open the session is safe to retry', async () => {
  const f = scripted([{ json: { access_token: 'tok' } }, { ok: false, status: 403, json: { error: { message: 'quotaExceeded' } } }]);
  const r = await publish(base(), opts({ fetchImpl: f }));
  assert.equal(r.outcome, 'refused'); assert.equal(r.retrySafe, true); assert.match(r.errors[0], /quotaExceeded/);
});

test('token refresh needs all three secrets and reports failures', async () => {
  await assert.rejects(accessToken({}, scripted([])), /missing YT_CLIENT_ID/);
  await assert.rejects(accessToken(env, scripted([{ ok: false, status: 400, json: { error: 'invalid_grant' } }])), /invalid_grant/);
  assert.equal(await accessToken(env, scripted([{ json: { access_token: 'abc' } }])), 'abc');
});
