// source-sync.mjs — ONE storyboard source, in GitHub (owner, 2026-09-16).
//
// The storyboard source used to live only on the PC (Documents\Codex\...\scene-board\storyboard.json), so cloud
// agents (Codex, Claude on the web) edited other copies and their changes never reached the page. Now the canonical
// copy is in this repo:
//     projects/garage-dream/source/storyboard.json
//     projects/garage-dream/source/reference-lock.json
// The PC folder keeps a working copy because older PC tools still write there. This script keeps the two equal:
// whichever copy is newer wins, the other is overwritten, and the loser is kept as a timestamped backup (never deleted).
//
//   node tools/source-sync.mjs          (build-board runs it first, automatically)
//
// Cloud agents: edit the files under projects/garage-dream/source/ and open a PR. Nothing else.
import fs from 'node:fs';
import path from 'node:path';
import { PC_SOURCE } from './paths.mjs';

const PC = PC_SOURCE;
const REPO = path.resolve('projects/garage-dream/source');
const PAIRS = !PC ? [] : [
  { name: 'storyboard.json', pc: PC + '/scene-board/storyboard.json', also: PC + '/scene-board/board-data.js' },
  { name: 'reference-lock.json', pc: PC + '/continuity-reference-pack/reference-lock.json' },
];

export function syncSources({ quiet = false } = {}) {
  fs.mkdirSync(REPO, { recursive: true });
  const bak = path.join(REPO, '_backups'); fs.mkdirSync(bak, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const out = [];
  for (const p of PAIRS) {
    const repo = path.join(REPO, p.name);
    const hasPc = fs.existsSync(p.pc), hasRepo = fs.existsSync(repo);
    if (!hasPc && !hasRepo) { out.push(`${p.name}: missing on both sides`); continue; }
    const a = hasPc ? fs.readFileSync(p.pc) : null, b = hasRepo ? fs.readFileSync(repo) : null;
    if (a && b && a.equals(b)) { out.push(`${p.name}: in sync`); continue; }
    const pcNewer = hasPc && (!hasRepo || fs.statSync(p.pc).mtimeMs > fs.statSync(repo).mtimeMs);
    JSON.parse((pcNewer ? a : b).toString('utf8'));   // never propagate a broken file
    if (pcNewer) {
      if (b) fs.writeFileSync(path.join(bak, `${p.name}.repo-before-${stamp}`), b);
      fs.writeFileSync(repo, a); out.push(`${p.name}: PC → repo`);
    } else if (hasPc || fs.existsSync(path.dirname(p.pc))) {
      if (a) fs.writeFileSync(path.join(bak, `${p.name}.pc-before-${stamp}`), a);
      fs.writeFileSync(p.pc, b);
      if (p.also) fs.writeFileSync(p.also, 'window.REXX_BOARD = ' + JSON.stringify(JSON.parse(b.toString('utf8'))) + ';\n');
      out.push(`${p.name}: repo → PC`);
    } else out.push(`${p.name}: repo only (no PC folder on this machine)`);
  }
  if (!quiet) console.log('source-sync: ' + out.join(' · '));
  return { dir: REPO, storyboard: path.join(REPO, 'storyboard.json'), lock: path.join(REPO, 'reference-lock.json') };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) syncSources();
