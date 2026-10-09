import crypto from 'node:crypto';
export const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase();
export function effectiveCut(cut) {
  if (cut.format !== 2) throw new Error('expected format-2 cut');
  const block = (b, lane) => ({ folder:b.folder, file:b.file, start:b.start, end:b.end,
    ...(lane === 'v1' ? {mute:Boolean(b.mute)} : {at:b.at}),
    ...(lane === 'a2' ? {gain:Number.isFinite(b.gain) ? b.gain : 0} : {}) });
  return {format:2, output:{width:cut.output?.width??1920,height:cut.output?.height??1080},
    v1:cut.v1.map(b=>block(b,'v1')),v2:(cut.v2||[]).map(b=>block(b,'v2')),a2:(cut.a2||[]).map(b=>block(b,'a2'))};
}
export function renderFingerprint(cut, rendererSha, sources) {
  return sha256(JSON.stringify({cut:effectiveCut(cut),rendererSha,sources:Object.entries(sources).sort(([a],[b])=>a.localeCompare(b))}));
}
export function assertPreview({expectedCutSha, fingerprint, timelineFingerprint = fingerprint, actualOutputSha, receipt, previous}) {
  if (receipt.cutSha256 !== expectedCutSha) throw new Error('STALE_PREVIEW: rendered cut hash differs from requested cut');
  if (receipt.outputSha256 !== actualOutputSha) throw new Error('STALE_PREVIEW: copied output hash differs from renderer receipt');
  if ((previous?.timelineFingerprint || previous?.fingerprint) && (previous.timelineFingerprint || previous.fingerprint) !== timelineFingerprint && previous.outputSha256 === actualOutputSha)
    throw new Error('STALE_PREVIEW: render inputs changed but preview bytes did not; delivery blocked');
  return true;
}
