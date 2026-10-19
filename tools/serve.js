const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT) || 5180;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };

// URL → файл внутри root, либо { status } при ошибке (400 — битый URL, 403 — выход за root).
function resolvePath(root, rawUrl) {
  let url;
  try { url = decodeURIComponent(String(rawUrl).split('?')[0]); } catch (e) { return { status: 400 }; }
  const file = path.normalize(path.join(root, url));
  if (!(file === root || file.startsWith(root + path.sep))) return { status: 403 };
  return { file };
}

if (require.main === module) {
  http.createServer((req, res) => {
    const r = resolvePath(ROOT, req.url);
    if (r.status) { res.writeHead(r.status); return res.end(); }
    let file = r.file;
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(buf);
    });
  }).listen(PORT, () => console.log(`Клинический компас: http://localhost:${PORT}`));
}

module.exports = { resolvePath };
