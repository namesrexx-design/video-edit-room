// Run the Instagram adapter against one queued post.
//
//   node instagram-cli.mjs --whoami                 read-only: which Instagram account does the token belong to
//   node instagram-cli.mjs <postId>                 dry run (default): validate, print the plan, send nothing
//   node instagram-cli.mjs <postId> --apply         PUBLISHES A REEL PUBLICLY NOW (post must be `approved`)
//
// Instagram has no private draft, so --apply is public the moment it succeeds. Needs IG_ACCESS_TOKEN,
// IG_USER_ID, R2_* (for the temporary public video link) and SCHEDULER_KEY in the environment.
import { publish, whoami } from './instagram.mjs';
import { r2PublicLink } from './r2-link.mjs';

const args = process.argv.slice(2);
if (args.includes('--whoami')) { console.log(JSON.stringify(await whoami(), null, 2)); process.exit(0); }
const id = args.find((a) => !a.startsWith('--')); const apply = args.includes('--apply');
if (!id) { console.error('usage: instagram-cli.mjs --whoami | <postId> [--apply]'); process.exit(2); }

const base = process.env.SCHEDULER_URL || 'http://127.0.0.1:8791';
const hdr = { 'content-type': 'application/json', ...(process.env.SCHEDULER_KEY ? { 'x-scheduler-key': process.env.SCHEDULER_KEY } : {}) };
const post = (await (await fetch(`${base}/posts`, { headers: hdr })).json()).find((p) => p.id === id);
if (!post) { console.error(`no post ${id}`); process.exit(1); }

const receipt = await publish(post, { dryRun: !apply, publicUrl: r2PublicLink });
console.log(JSON.stringify({ postId: id, applied: apply, ...receipt }, null, 2));
if (!apply || ['dry-run', 'refused'].includes(receipt.outcome)) process.exit(receipt.outcome === 'refused' ? 1 : 0);

// Record what happened. submitted -> posted; anything else keeps the status and stores the receipt, so an
// `unknown` outcome is never retried blindly.
const status = receipt.outcome === 'submitted' ? 'posted' : post.status;
const result = { ...(post.result || {}), platform: 'instagram', adapter: 'instagram@2026-09-20', ...receipt, recordedAt: new Date().toISOString() };
const r = await fetch(`${base}/posts/${id}`, { method: 'PATCH', headers: hdr, body: JSON.stringify({ status, result }) });
if (!r.ok) { console.error('could not record the receipt:', r.status, await r.text()); process.exit(3); }
