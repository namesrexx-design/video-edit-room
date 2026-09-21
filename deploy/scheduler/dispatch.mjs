// Turns one due, approved post into an adapter call and records what happened.
//
// Only platforms named in SCHEDULER_API_PLATFORMS ever reach here (server.mjs checks). Each adapter keeps its
// own guards; this file adds the scheduler-level rules:
//   1. The post leaves `approved` BEFORE the upload starts, so the next minute's tick can never post it twice.
//   2. `submitted` -> posted. `unknown` -> stays `ready` with the receipt, never retried, for a human to reconcile.
//      `failed` -> failed (retry-safe ones say so). `refused` -> ready with the reasons.
//   3. YouTube is always dispatched as a PRIVATE upload (no release time): the owner publishes it in Studio.
import { load, save, setStatus } from './store.mjs';

const REGISTRY = {
  youtube: async () => ({ publish: (await import('./adapters/youtube.mjs')).publish, opts: { privateDraft: true } }),
  instagram: async () => ({ publish: (await import('./adapters/instagram.mjs')).publish, opts: { publicUrl: (await import('./adapters/r2-link.mjs')).r2PublicLink } }),
  linkedin: async () => ({ publish: (await import('./adapters/linkedin.mjs')).publish, opts: {} }),
};
export const ADAPTER_PLATFORMS = Object.keys(REGISTRY);

export function claim(post) {
  const db = load();
  const p = db.posts.find((x) => x.id === post.id);
  if (!p || p.status !== 'approved') return null;
  const snapshot = { ...p };
  setStatus(db, p.id, 'ready', { ...(p.result || {}), mode: 'dispatching', startedAt: new Date().toISOString() });
  save(db);
  return snapshot;
}

export async function dispatch(post, { registry = REGISTRY, env = process.env } = {}) {
  const snap = claim(post);
  if (!snap) return { skipped: true };
  let receipt;
  try {
    const a = await (registry[snap.platform] || (async () => { throw new Error(`no adapter for ${snap.platform}`); }))();
    receipt = await a.publish(snap, { env, ...a.opts });
  } catch (e) { receipt = { outcome: 'unknown', note: `adapter threw: ${e.message}; reconcile before any retry` }; }
  const db = load();
  const result = { ...(snap.result || {}), platform: snap.platform, ...receipt, recordedAt: new Date().toISOString() };
  const status = receipt.outcome === 'submitted' ? 'posted' : receipt.outcome === 'failed' ? 'failed' : 'ready';
  setStatus(db, snap.id, status, result);
  save(db);
  return { id: snap.id, status, outcome: receipt.outcome };
}
