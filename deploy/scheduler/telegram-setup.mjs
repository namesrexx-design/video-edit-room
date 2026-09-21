// One-time: connect the Telegram bot to the scheduler without the token ever touching chat or git.
//
//   1. In Telegram, message @BotFather, send /newbot, pick a name; it replies with a token.
//   2. Open the new bot in Telegram and press Start (send it any message).
//   3. node telegram-setup.mjs   -> paste the token (hidden), it finds YOUR chat by itself,
//      sends you a test message, and saves TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID on the server.
//
// Then restart the scheduler: cd /srv/lyfe/repo/deploy && docker compose up -d --force-recreate scheduler
import { spawnSync } from 'node:child_process';
import readline from 'node:readline';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
let muted = false; const writeOut = rl._writeToOutput.bind(rl);
rl._writeToOutput = (s) => { if (!muted) writeOut(s); };
const lines = rl[Symbol.asyncIterator]();
process.stdout.write('Paste the bot token (hidden), then press Enter: '); muted = true;
const token = String((await lines.next()).value ?? '').trim().replace(/^['"]|['"]$/g, '');
muted = false; process.stdout.write('\n'); rl.close();
if (!/^\d+:[\w-]{30,}$/.test(token)) { console.error('That does not look like a bot token (digits, a colon, then letters). Nothing saved.'); process.exit(2); }

const api = (m, body) => fetch(`https://api.telegram.org/bot${token}/${m}`, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : undefined).then((r) => r.json());
const me = await api('getMe'); if (!me.ok) { console.error('Telegram rejected the token:', me.description, '. Nothing saved.'); process.exit(1); }
const ups = await api('getUpdates'); const msg = [...(ups.result || [])].reverse().find((u) => u.message?.chat?.type === 'private')?.message;
if (!msg) { console.error(`No message found. Open @${me.result.username} in Telegram, press Start, then run this again. Nothing saved.`); process.exit(1); }
const chat = String(msg.chat.id);
const t = await api('sendMessage', { chat_id: chat, text: 'LYFE scheduler connected. Posts that need you will arrive here with the video, the caption and a Posted button.' });
if (!t.ok) { console.error('Could not message you:', t.description, '. Nothing saved.'); process.exit(1); }

const key = process.env.LYFE_SSH_KEY || `${process.env.USERPROFILE || process.env.HOME}/.ssh/lyfe_studio_ed25519`;
const cmd = 'cd /srv/lyfe/repo/deploy && read -r T && read -r C && sed -i "/^TELEGRAM_BOT_TOKEN=/d;/^TELEGRAM_CHAT_ID=/d" .env && printf "TELEGRAM_BOT_TOKEN=%s\\nTELEGRAM_CHAT_ID=%s\\n" "$T" "$C" >> .env';
const r = spawnSync('ssh', ['-i', key, '-o', 'BatchMode=yes', 'root@2.28.123.22', cmd], { input: `${token}\n${chat}\n`, encoding: 'utf8' });
if (r.status !== 0) { console.error('Saved nothing on the server:', (r.stderr || 'ssh failed').trim()); process.exit(1); }
console.log(`Connected to @${me.result.username} (chat ${chat}). Token saved on the server only. Now restart the scheduler.`);
