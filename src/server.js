import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createQuote } from './quoteWorkflow.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const publicDir = normalize(join(__dirname, '..', 'public'));

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

export function createApp() {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');

      if (request.method === 'POST' && url.pathname === '/api/quote') {
        const body = await readJson(request);
        const quote = await createQuote(body);
        return sendJson(response, quote.ok ? 200 : 400, quote);
      }

      if (request.method === 'GET') {
        return serveStatic(url.pathname, response);
      }

      return sendJson(response, 405, { ok: false, message: 'Method not allowed.' });
    } catch (error) {
      return sendJson(response, 500, { ok: false, message: error.message });
    }
  });
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

async function serveStatic(pathname, response) {
  const safePath = pathname === '/' ? '/index.html' : pathname;
  const resolved = normalize(join(publicDir, safePath));
  if (!resolved.startsWith(publicDir)) {
    return sendJson(response, 403, { ok: false, message: 'Forbidden.' });
  }

  try {
    await readFile(resolved);
  } catch {
    return sendJson(response, 404, { ok: false, message: 'Not found.' });
  }

  response.writeHead(200, {
    'content-type': mimeTypes[extname(resolved)] || 'application/octet-stream'
  });
  createReadStream(resolved).pipe(response);
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4173);
  createApp().listen(port, '127.0.0.1', () => {
    console.log(`VIN Value Lookup demo listening on http://127.0.0.1:${port}`);
  });
}
