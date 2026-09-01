/**
 * A static server for the preview pages, so they can be opened on a phone.
 *
 *   node preview/serve.js [port]
 *
 * Node rather than `python -m http.server` for one reason: on this machine the installed
 * Python is blocked inbound by the firewall on the Public profile, so it serves localhost
 * happily and is unreachable from any other device — which looks exactly like the page
 * simply not loading. node.exe is allowed.
 */

const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const ROOT = __dirname;
const PORT = Number(process.argv[2] ?? 8080);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
};

http
  .createServer((req, res) => {
    const name = decodeURIComponent(req.url.split('?')[0]);
    const file = path.join(ROOT, name === '/' ? 'pixel.html' : name);

    // Nothing outside the preview directory, however the path is written.
    if (!file.startsWith(ROOT)) {
      res.writeHead(403).end('no');
      return;
    }

    fs.readFile(file, (error, body) => {
      if (error) {
        res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
        return;
      }
      res.writeHead(200, {
        'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream',
        // The page is rebuilt while it is being looked at.
        'cache-control': 'no-store',
      });
      res.end(body);
    });
  })
  .listen(PORT, '0.0.0.0', () => {
    const addresses = Object.values(os.networkInterfaces())
      .flat()
      .filter((n) => n.family === 'IPv4' && !n.internal)
      .map((n) => `  http://${n.address}:${PORT}/`);

    console.log(`serving ${ROOT}`);
    console.log(addresses.join('\n') || '  no network address found');
  });
