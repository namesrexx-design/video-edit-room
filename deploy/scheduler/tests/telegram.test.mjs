import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'tg-'));
process.env.SCHEDULER_DB = join(dir, 'posts.json');
writeFileSync(join(dir, 'v.mp4'), Buffer.alloc(2048, 1));
const { load, save, addPost, setStatus } = await import('../store.mjs');
const { sendPack, pack, applyCallback, pollButtons, notifyReady, enabled } = await import('../telegram.mjs');

const env = { TELEGRAM_BOT_TOKEN: 'T', TELEGRAM_CHAT_ID: '42' };
const mk = (o = {}) => { const db = load(); const p = addPost(db, { platform: 'tiktok', title: 'SN-02', caption: 'Numbers keep showing up.', asset: 'v.mp4', ai_generated: true, ...o }); setStatus(db, p.id, o.status || 'ready'); save(db); return { ...p, status: o.status || 'ready' }; };
const fetcher = (resp = { ok: true, result: { message_id: 7 } }, calls = []) => async (url, init) => { calls.push({ url, init }); return { ok: resp.ok !== false, status: resp.ok === false ? 400 : 200, json: async () => resp }; };

test('off unless both token and chat id are set', async () => {
  assert.equal(enabled({}), false); assert.equal(enabled(env), true);
  assert.deepEqual(await sendPack(mk(), { env: {}, fetchImpl: fetcher(), mediaRoot: dir }), { sent: false, note: 'telegram not configured' });
});

test('pack carries platform, caption and the AI-label reminder', () => {
  const t = pack({ platform: 'instagram', title: 'T', caption: 'cap', ai_generated: true });
  assert.match(t, /Instagram/); assert.match(t, /cap/); assert.match(t, /AI-generated label ON/);
});

test('sends the video with Posted/Skip buttons', async () => {
  const calls = []; const p = mk();
  const r = await sendPack(p, { env, fetchImpl: fetcher(undefined, calls), mediaRoot: dir });
  assert.equal(r.sent, true); assert.equal(r.withVideo, true);
  assert.match(calls[0].url, /\/botT\/sendVideo$/);
  const kb = JSON.parse(calls[0].init.body.get('reply_markup')); assert.equal(kb.inline_keyboard[0][0].callback_data, `posted:${p.id}`);
  assert.equal(calls[0].init.body.get('chat_id'), '42');
});

test('missing video falls back to a text message; a Telegram error is reported, not thrown', async () => {
  const calls = []; const r = await sendPack(mk({ asset: 'nope.mp4' }), { env, fetchImpl: fetcher(undefined, calls), mediaRoot: dir });
  assert.equal(r.sent, true); assert.equal(r.withVideo, false); assert.match(calls[0].url, /sendMessage$/);
  const bad = await sendPack(mk(), { env, fetchImpl: fetcher({ ok: false, description: 'chat not found' }), mediaRoot: dir });
  assert.equal(bad.sent, false); assert.match(bad.note, /chat not found/);
  const boom = await sendPack(mk(), { env, fetchImpl: async () => { throw new Error('net down'); }, mediaRoot: dir });
  assert.match(boom.note, /net down/);
});

test('notifyReady records the receipt on the post', async () => {
  const p = mk(); await notifyReady([p], { env, fetchImpl: fetcher(), mediaRoot: dir });
  assert.equal(load().posts.find((x) => x.id === p.id).result.telegram.sent, true);
});

test('Posted marks a ready post; other statuses and junk are ignored', () => {
  const p = mk(); assert.deepEqual(applyCallback(`posted:${p.id}`), { id: p.id, status: 'posted' });
  assert.deepEqual(applyCallback(`posted:${p.id}`), { ignored: true });        // already posted
  const d = mk({ status: 'draft' }); assert.deepEqual(applyCallback(`skip:${d.id}`), { ignored: true });   // never from draft
  assert.equal(applyCallback('garbage'), null);
});

test('only buttons pressed in Rexx\'s own chat count', async () => {
  const p = mk(); const upd = (chat) => ({ ok: true, result: [{ update_id: 1, callback_query: { id: 'c', data: `skip:${p.id}`, message: { chat: { id: chat } } } }] });
  await pollButtons({ env, fetchImpl: fetcher(upd(999)) });
  assert.equal(load().posts.find((x) => x.id === p.id).status, 'ready');           // stranger's press ignored
  await pollButtons({ env, fetchImpl: fetcher({ ok: true, result: [{ update_id: 2, callback_query: { id: 'c', data: `skip:${p.id}`, message: { chat: { id: 42 } } } }] }) });
  assert.equal(load().posts.find((x) => x.id === p.id).status, 'skipped');
});
