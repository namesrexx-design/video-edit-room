// Minimal OpenTimelineIO (.otio) writer/reader for one-track cuts.
// Written by hand on purpose: no dependency, readable diffs, and DaVinci Resolve
// (File > Import > Timeline) opens the result directly.
import fs from 'node:fs';
import path from 'node:path';

export const RATE = 24;

const rt = value => ({ OTIO_SCHEMA: 'RationalTime.1', rate: RATE, value });
const range = (start, dur) => ({ OTIO_SCHEMA: 'TimeRange.1', start_time: rt(start), duration: rt(dur) });

export const fileUrl = p => 'file:///' + path.resolve(p).replace(/\\/g, '/').replace(/^\/+/, '');
export const fromFileUrl = u => decodeURIComponent(u.replace(/^file:\/\/\/?/, '')).replace(/^\/([A-Za-z]:)/, '$1');

/** clips: [{ name, file, start, duration, available }] in frames. */
export function buildTimeline(name, clips, metadata = {}) {
  const items = clips.map(c => ({
    OTIO_SCHEMA: 'Clip.2',
    name: c.name,
    source_range: range(c.start, c.duration),
    media_references: {
      DEFAULT_MEDIA: {
        OTIO_SCHEMA: 'ExternalReference.1',
        name: path.basename(c.file),
        target_url: fileUrl(c.file),
        available_range: range(0, c.available ?? c.start + c.duration),
        metadata: c.sha256 ? { sha256: c.sha256 } : {},
      },
    },
    active_media_reference_key: 'DEFAULT_MEDIA',
    metadata: c.note ? { note: c.note } : {},
  }));
  const track = (kind, label) => ({ OTIO_SCHEMA: 'Track.1', name: label, kind, children: structuredClone(items), metadata: {} });
  return {
    OTIO_SCHEMA: 'Timeline.1',
    name,
    global_start_time: rt(0),
    metadata: { editroom: { rate: RATE, width: 1920, height: 1080, ...metadata } },
    tracks: { OTIO_SCHEMA: 'Stack.1', name: 'tracks', children: [track('Video', 'V1'), track('Audio', 'A1')], metadata: {} },
  };
}

/** Returns [{ name, file, start, duration, kind:'clip'|'gap' }] from the first video track. */
export function readTimeline(p) {
  const tl = JSON.parse(fs.readFileSync(p, 'utf8'));
  const stack = tl.tracks?.children ?? [];
  const video = stack.find(t => (t.kind || '').toLowerCase() === 'video') ?? stack[0];
  if (!video) throw new Error('no video track in ' + p);
  const out = []; const warnings = [];
  for (const it of video.children) {
    const schema = (it.OTIO_SCHEMA || '').split('.')[0];
    if (schema === 'Gap') { out.push({ kind: 'gap', name: it.name || 'gap', duration: frames(it.source_range.duration) }); continue; }
    if (schema === 'Transition') { warnings.push(`transition "${it.name}" ignored (hard cut)`); continue; }
    if (schema !== 'Clip') { warnings.push(`unsupported item ${it.OTIO_SCHEMA} skipped`); continue; }
    const ref = it.media_reference ?? it.media_references?.[it.active_media_reference_key ?? 'DEFAULT_MEDIA'];
    if (!ref?.target_url) throw new Error(`clip "${it.name}" has no media file`);
    const sr = it.source_range ?? ref.available_range;
    out.push({ kind: 'clip', name: it.name, file: fromFileUrl(ref.target_url), start: frames(sr.start_time), duration: frames(sr.duration), sha256: ref.metadata?.sha256 });
  }
  const audio = stack.find(t => (t.kind || '').toLowerCase() === 'audio');
  if (audio && JSON.stringify(strip(audio.children)) !== JSON.stringify(strip(video.children))) warnings.push('A1 differs from V1: picture-clip audio is used, A1 is ignored');
  // Frame size comes from the timeline's own metadata (buildTimeline writes it); 1920x1080 when absent.
  const ed = tl.metadata?.editroom ?? {};
  const width = Number(ed.width) || 1920, height = Number(ed.height) || 1080;
  return { name: tl.name, items: out, warnings, rate: RATE, width, height };
}

const frames = t => { const v = t.rate === RATE ? t.value : t.value * RATE / t.rate; const r = Math.round(v); if (Math.abs(r - v) > 1e-6) throw new Error('non-integer frame ' + v); return r; };
const strip = ch => ch.map(c => [c.OTIO_SCHEMA, c.name, c.source_range]);

export const tc = f => { const ff = f % RATE, s = Math.floor(f / RATE); return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60, ff].map(n => String(n).padStart(2, '0')).join(':'); };

/** CMX3600 EDL for the same cut. Reel AX + clip-name comments; Resolve relinks by clip name. */
export function buildEdl(name, clips) {
  let rec = 0, n = 0; const lines = [`TITLE: ${name}`, 'FCM: NON-DROP FRAME', ''];
  for (const c of clips) {
    n++; const a = c.start, b = c.start + c.duration;
    lines.push(`${String(n).padStart(3, '0')}  AX       AA/V  C        ${tc(a)} ${tc(b)} ${tc(rec)} ${tc(rec + c.duration)}`);
    lines.push(`* FROM CLIP NAME: ${path.basename(c.file)}`, '');
    rec += c.duration;
  }
  return lines.join('\n');
}
