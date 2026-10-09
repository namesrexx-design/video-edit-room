// Make a short-lived PUBLIC link to one video, because Meta must be able to download it and our media
// folder is behind a password. Uses rclone (already in the studio image, configured by the R2_* env in
// deploy/.env): copy the file to a temp prefix in the R2 bucket, then `rclone link --expire`.
// The temp object is left in place (never delete); only the link expires. Keys never leave the server.
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { extname } from 'node:path';
import { promisify } from 'node:util';
const run = promisify(execFile);

async function sha(path) {
  const h = createHash('sha256');
  for await (const chunk of createReadStream(path)) h.update(chunk);
  return h.digest('hex');
}

export async function r2PublicLink(post, filePath, { bucket = process.env.R2_BUCKET, expire = '3h', exec = run } = {}) {
  if (!bucket) throw new Error('R2_BUCKET is not set');
  const key = `tmp-publish/${(await sha(filePath)).slice(0, 24)}${extname(filePath).toLowerCase()}`;
  await exec('rclone', ['copyto', filePath, `R2:${bucket}/${key}`, '--s3-no-check-bucket']);
  const { stdout } = await exec('rclone', ['link', `R2:${bucket}/${key}`, '--expire', expire]);
  const url = stdout.trim().split('\n').pop();
  if (!/^https:\/\//.test(url)) throw new Error('rclone did not return an https link');
  return url;
}
