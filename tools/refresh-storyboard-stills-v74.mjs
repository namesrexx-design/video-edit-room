// Refresh every scene still in the storyboard SOURCE OF TRUTH from the V74 base cut.
// For each scene that has a v74 range, grab a frame from GARAGE-DREAM-V74 at that time,
// save it as scene-board/current-frames/<id>-start-V74.jpg, point the scene's `image` at it,
// keep the old image path in `imageHistory`, regenerate board-data.js. Backups first.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const W = 'C:/Users/16263/Documents/Codex/2026-09-04/referenced-chatgpt-conversation-this-is-an-2';
const SB = W + '/scene-board/storyboard.json';
const BD = W + '/scene-board/board-data.js';
const V74 = 'D:/REXX/AI_Video/BizBox-Garage-Dream/garage-through-apu-review/full-working-cut/GARAGE-DREAM-V74-CANDIDATE-CLAUDE-2026-09-14.mp4';
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
fs.copyFileSync(SB, `${SB}.bak-${stamp}-pre-v74-stills`);
fs.copyFileSync(BD, `${BD}.bak-${stamp}-pre-v74-stills`);
const b = JSON.parse(fs.readFileSync(SB, 'utf8'));
fs.mkdirSync(W + '/scene-board/current-frames', { recursive: true });

// scenes that share one V74 range get frames at different points inside it
const seen = new Map(); let done = 0;
for (const s of b.scenes) {
  const r = s.v74?.episodeSeconds; if (!r) continue;
  const key = r.join('-'); const nth = seen.get(key) || 0; seen.set(key, nth + 1);
  const len = r[1] - r[0]; const at = nth === 0 ? r[0] + Math.min(1, len * 0.25) : r[0] + len * (0.45 + 0.25 * nth);
  const rel = `current-frames/${s.id}-start-V74.jpg`; const dest = `${W}/scene-board/${rel}`;
  const x = spawnSync('ffmpeg', ['-v', 'error', '-nostdin', '-y', '-ss', at.toFixed(3), '-i', V74, '-frames:v', '1', '-q:v', '3', dest], { stdio: 'pipe' });
  if (x.status !== 0) { console.log(s.id, 'FAILED', x.stderr.toString().slice(-200)); continue; }
  s.imageHistory = [...(s.imageHistory || []), { image: s.image || null, replacedAt: new Date().toISOString(), reason: 'refreshed from V74 base cut' }];
  s.image = rel; s.imageSource = { cut: 'V74', file: 'GARAGE-DREAM-V74-CANDIDATE-CLAUDE-2026-09-14.mp4', atSeconds: +at.toFixed(3), takenAt: new Date().toISOString() };
  done++; console.log(s.id, '->', rel, '@', at.toFixed(2) + 's');
}
b.stillRefresh = { cut: 'V74', at: new Date().toISOString(), by: 'Claude (MASTER) at owner request', scenes: done, note: 'Scene stills now come from the V74 base cut. Scenes not in V74 keep their old still and are flagged by date in LYFE Studio.' };
fs.writeFileSync(SB, JSON.stringify(b, null, 2) + '\n');
fs.writeFileSync(BD, 'window.REXX_BOARD = ' + JSON.stringify(b, null, 2) + ';\n');
console.log(`refreshed ${done} scene stills from V74; board-data.js regenerated; backups *.bak-${stamp}-pre-v74-stills`);
