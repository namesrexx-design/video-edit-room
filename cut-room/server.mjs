// tiny static server for local testing of the Cut Room page (mirrors the artifact layout)
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')));
const port = Number(process.env.CUT_ROOM_PORT || 4321);
const types = { '.html': 'text/html', '.mp4': 'video/mp4', '.jpg': 'image/jpeg', '.json': 'application/json', '.js': 'text/javascript' };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(root, p); if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nope'); }
  const size = fs.statSync(f).size; const type = types[path.extname(f)] || 'application/octet-stream';
  const range = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
  if (range) { const a = +range[1] || 0, b = range[2] ? +range[2] : size - 1; res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${a}-${b}/${size}`, 'Content-Length': b - a + 1, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' }); return fs.createReadStream(f, { start: a, end: b }).pipe(res); }
  if (p === '/index.html') { const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + fs.readFileSync(f, 'utf8') + '</body></html>'; res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' }); return res.end(html); }
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(res);
}).listen(port, () => console.log(`cut room test server on http://localhost:${port}`));
