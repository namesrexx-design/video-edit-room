// Run the YouTube adapter against one queued post.
//
//   node youtube-cli.mjs <postId>                     dry run (default): validate and print the plan, send nothing
//   node youtube-cli.mjs <postId> --private-draft --apply   upload a PRIVATE video with no release time
//   node youtube-cli.mjs <postId> --apply             upload private + YouTube publishAt (post must be `approved`)
//
// Needs, in the environment (never in git): YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN,
// SCHEDULER_KEY. Talks to the scheduler over its own API and writes the receipt back to the post.
import { publish } from './youtube.mjs';

const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith('--'));
const apply = args.includes('--apply');
const privateDraft = args.includes('--private-draft');
if (!id) { console.error('usage: youtube-cli.mjs <postId> [--private-draft] [--apply]'); process.exit(2); }

const base = process.env.SCHEDULER_URL || 'http://127.0.0.1:8791';
const hdr = { 'content-type': 'application/json', ...(process.env.SCHEDULER_KEY ? { 'x-scheduler-key': process.env.SCHEDULER_KEY } : {}) };
const posts = await (await fetch(`${base}/posts`, { headers: hdr })).json();
const post = posts.find((p) => p.id === id);
if (!post) { console.error(`no post ${id}`); process.exit(1); }

const receipt = await publish(post, { dryRun: !apply, privateDraft });
console.log(JSON.stringify({ postId: id, applied: apply, ...receipt }, null, 2));
if (!apply || receipt.outcome === 'dry-run' || receipt.outcome === 'refused') process.exit(receipt.outcome === 'refused' ? 1 : 0);

// Record what happened. `unknown` is stored as-is so nobody retries it blindly.
const keep = post.status;
const result = { ...(post.result || {}), platform: 'youtube', adapter: 'youtube@2026-09-20', ...receipt, recordedAt: new Date().toISOString() };
const r = await fetch(`${base}/posts/${id}`, { method: 'PATCH', headers: hdr, body: JSON.stringify({ status: keep, result }) });
if (!r.ok) { console.error('could not record the receipt:', r.status, await r.text()); process.exit(3); }
