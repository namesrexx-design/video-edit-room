// One-time: Rexx signs in to Google on his own PC and this saves the resulting refresh token on the
// server. Nobody else sees the token: it goes straight into the server's .env, never to chat or git.
//
//   set YT_CLIENT_ID=...      (PowerShell: $env:YT_CLIENT_ID='...')
//   set YT_CLIENT_SECRET=...
//   node youtube-auth.mjs
//
// It opens a local page on 127.0.0.1, prints the Google consent URL, waits for Google to send you
// back, swaps the code for a refresh token and writes YT_CLIENT_ID / YT_CLIENT_SECRET / YT_REFRESH_TOKEN
// into /srv/lyfe/repo/deploy/.env on the server over the existing SSH key. Scope is upload-only.
// UNTESTED against live Google as of 2026-09-20: it needs Rexx's OAuth client to try.
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

import readline from 'node:readline';

// Ask for a value. The secret is typed hidden: nothing is echoed and nothing is stored on this PC.
function ask(question, hidden) {
  return new Promise((done) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    process.stdout.write(question);
    if (hidden) { rl.stdoutMuted = true; rl._writeToOutput = (s) => { if (!rl.stdoutMuted) rl.output.write(s); }; }
    rl.question('', (a) => { rl.close(); if (hidden) process.stdout.write('\n'); done(String(a).trim().replace(/^['"]|['"]$/g, '')); });
  });
}

const id = process.env.YT_CLIENT_ID || await ask('Paste the Client ID, then press Enter: ', false);
const secret = process.env.YT_CLIENT_SECRET || await ask('Paste the Client secret (it stays hidden as you paste), then press Enter: ', true);
if (!id || !secret) { console.error('Nothing pasted, nothing saved.'); process.exit(2); }
if (!/\.apps\.googleusercontent\.com$/.test(id)) { console.error('That does not look like a Client ID (it should end in .apps.googleusercontent.com). Nothing saved.'); process.exit(2); }

// Fail early, before Google, if this PC cannot reach the server.
const probe = spawnSync('ssh', ['-i', process.env.LYFE_SSH_KEY || `${process.env.USERPROFILE || process.env.HOME}/.ssh/lyfe_studio_ed25519`, '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', 'root@2.28.123.22', 'test -w /srv/lyfe/repo/deploy/.env && echo ok'], { encoding: 'utf8' });
if (!/ok/.test(probe.stdout || '')) { console.error('This PC cannot write to the server .env (' + (probe.stderr || 'ssh failed').trim() + '). Nothing saved.'); process.exit(1); }
console.log('Server reachable. Now sign in with Google.');
const PORT = 53682; const redirect = `http://127.0.0.1:${PORT}/cb`; const state = randomBytes(12).toString('hex');
const scope = 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly';
const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({ client_id: id, redirect_uri: redirect, response_type: 'code', scope, access_type: 'offline', prompt: 'consent', state });
console.log('\nOpen this in the browser signed in as the channel owner, and approve:\n\n' + url + '\n');

const server = createServer(async (req, res) => {
  const u = new URL(req.url, redirect);
  if (u.pathname !== '/cb') { res.writeHead(404); return res.end(); }
  if (u.searchParams.get('state') !== state) { res.writeHead(400); return res.end('state mismatch'); }
  const code = u.searchParams.get('code');
  const t = await (await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: id, client_secret: secret, redirect_uri: redirect, grant_type: 'authorization_code' }) })).json();
  if (!t.refresh_token) { res.writeHead(500); res.end('No refresh token came back. Remove the app from myaccount.google.com/permissions and run this again.'); console.error('no refresh_token in response:', Object.keys(t)); process.exit(1); }
  const cmd = 'cd /srv/lyfe/repo/deploy && read -r I && read -r S && read -r R && sed -i "/^YT_CLIENT_ID=/d;/^YT_CLIENT_SECRET=/d;/^YT_REFRESH_TOKEN=/d" .env && printf "YT_CLIENT_ID=%s\\nYT_CLIENT_SECRET=%s\\nYT_REFRESH_TOKEN=%s\\n" "$I" "$S" "$R" >> .env';
  const r = spawnSync('ssh', ['-i', process.env.LYFE_SSH_KEY || `${process.env.USERPROFILE || process.env.HOME}/.ssh/lyfe_studio_ed25519`, '-o', 'BatchMode=yes', 'root@2.28.123.22', cmd], { input: `${id}\n${secret}\n${t.refresh_token}\n`, encoding: 'utf8' });
  if (r.status !== 0) { res.writeHead(500); res.end('Saved nothing: ' + (r.stderr || 'ssh failed')); console.error(r.stderr); process.exit(1); }
  res.writeHead(200, { 'content-type': 'text/plain' }); res.end('YouTube is connected. You can close this tab.');
  console.log('Refresh token saved on the server. Nothing was printed or stored elsewhere.');
  server.close(); process.exit(0);
});
server.listen(PORT, '127.0.0.1');
