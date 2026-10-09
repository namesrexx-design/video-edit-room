import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.SCHEDULER_DB = join(mkdtempSync(join(tmpdir(), 'disp-')), 'posts.json');
const { load, save, addPost, setStatus } = await import('../store.mjs');
const { dispatch } = await import('../dispatch.mjs');

function seed(over = {}) {
  const db = load();
  const p = addPost(db, { platform: 'youtube', title: 't', caption: 'c', asset: 'a.mp4', status: 'approved', scheduled_at: new Date(Date.now() - 1000).toISOString(), ai_generated: true, ...over });
  setStatus(db, p.id, over.status || 'approved'); save(db); return { ...p, status: over.status || 'approved' };
}
const reg = (outcome, extra = {}, seen = {}) => ({ youtube: async () => ({ publish: async (post) => { seen.status = post.status; seen.during = load().posts.find((x) => x.id === post.id).status; return { outcome, ...extra }; }, opts: {} }) });
const get = (id) => load().posts.find((p) => p.id === id);

test('claims before publishing: the post is out of approved while the adapter runs', async () => {
  const p = seed(); const seen = {};
  await dispatch(p, { registry: reg('submitted', { nativeId: 'X' }, seen) });
  assert.equal(seen.during, 'ready'); assert.equal(seen.status, 'approved');   // adapter still sees an approved copy
  assert.equal(get(p.id).status, 'posted'); assert.equal(get(p.id).result.nativeId, 'X');
});

test('unknown stays ready with the receipt and is never posted twice', async () => {
  const p = seed(); let n = 0;
  const registry = { youtube: async () => ({ publish: async () => { n++; return { outcome: 'unknown', note: 'reconcile' }; }, opts: {} }) };
  await dispatch(p, { registry });
  assert.equal(get(p.id).status, 'ready'); assert.equal(get(p.id).result.outcome, 'unknown');
  assert.deepEqual(await dispatch(p, { registry }), { skipped: true }); assert.equal(n, 1);
});

test('failed -> failed; refused -> ready with reasons; adapter throw -> unknown, not failed', async () => {
  const a = seed(); await dispatch(a, { registry: reg('failed', { retrySafe: true }) }); assert.equal(get(a.id).status, 'failed');
  const b = seed(); await dispatch(b, { registry: reg('refused', { errors: ['no'] }) }); assert.equal(get(b.id).status, 'ready');
  const c = seed(); await dispatch(c, { registry: { youtube: async () => ({ publish: async () => { throw new Error('boom'); }, opts: {} }) } });
  assert.equal(get(c.id).status, 'ready'); assert.equal(get(c.id).result.outcome, 'unknown');
});

test('a post that is not approved is skipped', async () => {
  const p = seed({ status: 'draft' });
  assert.deepEqual(await dispatch(p, { registry: reg('submitted') }), { skipped: true });
});
