// Wersja przeglądarkowa do testów: serwuje renderer/ bez pamięci podręcznej (zawsze świeże pliki).
// node scripts/serve.mjs  →  http://localhost:8770
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'renderer');
const port = Number(process.env.PORT || 8770);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
http.createServer(async (req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^[/\\]+/, '') || 'index.html';
  try {
    const body = await readFile(join(root, p.includes('..') ? 'index.html' : p));
    res.writeHead(200, { 'Content-Type': types[extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch (e) { res.writeHead(404); res.end('nie ma'); }
}).listen(port, () => console.log('Blat (przeglądarka): http://localhost:' + port));
