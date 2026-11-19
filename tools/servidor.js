/* Servidor local para ver el sitio mientras se trabaja:  node tools/servidor.js [puerto]
   Sirve la carpeta del proyecto y, a diferencia de `python -m http.server`,
   responde pedidos parciales (Range). Sin eso el navegador no puede saltar a
   otro punto de una canción, y el scratch de los discos no mueve la pista. */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.argv[2] || process.env.PORT || 4173);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
  '.mp4': 'video/mp4', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml',
};

http.createServer((req, res) => {
  let file;
  try {
    const url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    file = path.join(ROOT, url);
  } catch (_) { res.writeHead(400).end(); return; }
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) { res.writeHead(403).end(); return; }
  fs.stat(file, (err, stat) => {
    if (!err && stat.isDirectory()) { file = path.join(file, 'index.html'); try { stat = fs.statSync(file); } catch (e) { err = e; } }
    if (err || !stat.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('No existe'); return; }
    const head = {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-cache', // siempre la última versión de lo que se está editando
      'Last-Modified': stat.mtime.toUTCString(),
    };
    const since = req.headers['if-modified-since'];
    if (since && !req.headers.range && Math.floor(stat.mtimeMs / 1000) <= Math.floor(Date.parse(since) / 1000)) { res.writeHead(304, head).end(); return; }
    let start = 0, end = stat.size - 1, status = 200;
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (range && (range[1] || range[2]) && stat.size > 0) {
      if (range[1]) { start = Number(range[1]); if (range[2]) end = Math.min(end, Number(range[2])); }
      else start = Math.max(0, stat.size - Number(range[2]));
      if (start > end || start >= stat.size) { res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }).end(); return; }
      status = 206;
      head['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
    }
    head['Content-Length'] = stat.size ? end - start + 1 : 0;
    res.writeHead(status, head);
    if (req.method === 'HEAD' || !stat.size) { res.end(); return; }
    fs.createReadStream(file, { start, end }).on('error', () => res.destroy()).pipe(res);
  });
}).listen(PORT, '127.0.0.1', () => console.log(`Legal Groove en http://localhost:${PORT}`));
