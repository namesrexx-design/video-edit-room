import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('..', import.meta.url));
const run = (cmd, args, options = {}) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...options });
  assert.equal(r.status, 0, r.stderr || String(r.error));
  return r.stdout;
};
const waitFor = async (check, timeout = 20000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise(r => setTimeout(r, 100));
  }
  throw Error('Timed out waiting for test condition');
};

test('Brand Build: real builder, upload API and connector refresh', { timeout: 45000 }, async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lyfe-brand-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const media = path.join(root, 'media'), editor = path.join(root, 'editor');
  const brandDir = path.join(media, 'team/garage-dream/brand');
  for (const dir of ['tools', 'cut-room', 'projects/garage-dream/source', 'bin', 'editor', 'media']) fs.mkdirSync(path.join(root, dir), { recursive: true });
  for (const name of ['build-board.mjs', 'source-sync.mjs', 'paths.mjs']) fs.copyFileSync(path.join(repo, 'tools', name), path.join(root, 'tools', name));
  fs.writeFileSync(path.join(root, 'projects/garage-dream/source/storyboard.json'), JSON.stringify({ scenes: [], version: 'test' }));
  fs.writeFileSync(path.join(root, 'projects/garage-dream/source/reference-lock.json'), '{}');
  const env = { ...process.env, LYFE_MEDIA_ROOT: media, LYFE_EDITOR_DIR: editor, LYFE_PC_SOURCE: '', LYFE_SERVER: '1', LYFE_REPO: root };
  const build = () => { run(process.execPath, ['tools/build-board.mjs'], { cwd: root, env }); return JSON.parse(fs.readFileSync(path.join(editor, 'board.json'))); };
  const png = path.join(root, 'sample.png');
  run('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=teal:s=640x160', '-frames:v', '1', '-threads', '1', png]);

  await t.test('missing and empty brand directories produce an empty group', () => {
    assert.deepEqual(build().brand, { key: 'brand', label: 'Brand Build', items: [] });
    fs.mkdirSync(brandDir, { recursive: true });
    assert.equal(build().brand.items.length, 0);
  });
  await t.test('newest first, encoded originals, short-video posters and distinct IDs', () => {
    fs.mkdirSync(path.join(brandDir, 'nested'));
    for (const name of ['banner #1.png', 'same.png', 'nested/same.png']) fs.copyFileSync(png, path.join(brandDir, name));
    fs.writeFileSync(path.join(brandDir, 'ignore.txt'), 'not artwork');
    run('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=yellow:s=160x90:r=24', '-frames:v', '2', '-c:v', 'libx264', '-threads', '1', path.join(brandDir, 'short.mp4')]);
    fs.utimesSync(path.join(brandDir, 'banner #1.png'), new Date('2030-01-01'), new Date('2030-01-01'));
    const b = build();
    assert.equal(b.brand.items.length, 4);
    assert.equal(b.brand.items[0].file, 'banner #1.png');
    assert.equal(b.brand.items[0].fullUrl, '/media/team/garage-dream/brand/banner%20%231.png');
    assert.equal(new Set(b.brand.items.map(x => x.id)).size, 4);
    assert.ok(b.brand.items.every(x => x.img?.shape === 'land'));
    assert.equal(b.brand.items.find(x => x.file === 'short.mp4').videoUrl, '/media/team/garage-dream/brand/short.mp4');
    assert.ok(fs.existsSync(path.join(editor, 'sheets/brand.jpg')));
    assert.deepEqual(b.merch.map(x => x.key), ['hats', 'mugs', 'shirts', 'shirt-designs']);
  });

  // External commands are isolated; actual HTTP handling, filesystem writes,
  // board generation and the periodic team-sync path run unchanged.
  const bin = path.join(root, 'bin');
  fs.writeFileSync(path.join(bin, 'git'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'rclone'), `#!${process.execPath}\n` +
    `const fs=require('fs'),path=require('path');const a=process.argv.slice(2);\n` +
    `fs.appendFileSync(process.env.TEST_COPY_LOG,JSON.stringify(a)+'\\n');\n` +
    `if(a.includes('-q')){const d=path.join(a[2],'garage-dream/brand');fs.mkdirSync(d,{recursive:true});if(!fs.existsSync(path.join(d,'connector-arrival.png')))fs.copyFileSync(process.env.TEST_IMAGE,path.join(d,'connector-arrival.png'));}\n`, { mode: 0o755 });
  const portServer = net.createServer();
  await new Promise(r => portServer.listen(0, '127.0.0.1', r));
  const port = portServer.address().port;
  await new Promise(r => portServer.close(r));
  const child = spawn(process.execPath, [path.join(repo, 'deploy/studio-api.mjs')], { cwd: root, env: { ...env, PATH: bin + path.delimiter + process.env.PATH, STUDIO_API_PORT: String(port), TEAM_MEDIA_PREFIX: 'tenants/test-team/', TEST_COPY_LOG: path.join(root, 'copies.log'), TEST_IMAGE: png }, stdio: 'ignore' });
  t.after(async () => { child.kill(); await new Promise(r => child.once('exit', r)); });
  const origin = `http://127.0.0.1:${port}`;
  await waitFor(async () => { try { return (await fetch(origin + '/api/health')).ok; } catch { return false; } });
  const upload = (query, body = fs.readFileSync(png)) => fetch(origin + '/upload?' + query, { method: 'POST', body });
  const done = async response => {
    assert.equal(response.status, 202);
    const first = await response.json(); let result;
    await waitFor(async () => { result = await fetch(origin + '/api/jobs/' + first.id).then(r => r.json()); return ['done', 'failed'].includes(result.state); });
    assert.equal(result.state, 'done', result.log);
    return result;
  };
  await t.test('rejects unsupported files and ambiguous group parameters', async () => {
    for (const q of ['brand=1&name=bad.svg', 'brand=0&name=x.png', 'brand=1&merch=hats&name=x.png', 'brand=1&scene=S08&name=x.png']) assert.equal((await upload(q)).status, 400);
  });
  await t.test('uploads preserve earlier files, rebuild the board and use the team cloud prefix', async () => {
    const a = await done(await upload('brand=1&name=hero.png'));
    const b = await done(await upload('brand=1&name=hero.png'));
    assert.notEqual(a.result.file, b.result.file);
    for (const file of [a.result.file, b.result.file]) {
      assert.equal(path.dirname(file), brandDir);
      assert.deepEqual(fs.readFileSync(file), fs.readFileSync(png));
    }
    const board = JSON.parse(fs.readFileSync(path.join(editor, 'board.json')));
    assert.equal(board.brand.items.length, 6);
    const copies = fs.readFileSync(path.join(root, 'copies.log'), 'utf8').trim().split('\n').map(JSON.parse);
    assert.ok(copies.some(a => a[2] === 'r2:lyfe-studio/tenants/test-team/garage-dream/brand'));
  });
  await t.test('sanitizes paths and keeps the Merch upload route working', async () => {
    const a = await done(await upload('brand=1&name=..%2Fescape.png'));
    assert.equal(path.dirname(a.result.file), brandDir);
    const m = await done(await upload('merch=hats&name=hat.png'));
    assert.equal(path.dirname(m.result.file), path.join(media, 'merch/hats'));
  });
  await t.test('connector arrivals rebuild Brand Build even without a Git commit', async () => {
    await waitFor(() => JSON.parse(fs.readFileSync(path.join(editor, 'board.json'))).brand.items.some(x => x.file === 'connector-arrival.png'));
  });
});
