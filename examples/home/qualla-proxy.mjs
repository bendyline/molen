// Dev-only read-through proxy for qualla.com's published map data, so the examples can load a
// Qualla terrain release from localhost (qualla.com sends no CORS headers). `/qualla/<path>`
// fetches `https://qualla.com/<path>`, forwarding Range. JSON documents are rewritten so the
// absolute (`https://qualla.com/…`) and root-relative (`/_data/…`, `/_a/…`) URLs inside them come
// back through the proxy too. A JSON document qualla.com does not serve falls back to the sibling
// qualla-internal checkout's built copy (`QUALLA_PUBLIC` overrides the directory), e.g. the vector
// tiles' `archive-set.json`, which the site itself never fetches.

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join, normalize, resolve, sep } from 'node:path';
import { pipeline, Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

export const QUALLA_PREFIX = '/qualla/';
const ORIGIN = 'https://qualla.com/';
const here = dirname(fileURLToPath(import.meta.url));
const localRoot = resolve(
  process.env.QUALLA_PUBLIC ?? join(here, '../../../qualla-internal/site/public'),
);
const FORWARDED = [
  'accept-ranges',
  'cache-control',
  'content-range',
  'content-type',
  'etag',
  'last-modified',
];

/** `self` is this proxy's absolute base: package schemas require absolute source URLs. */
function rewriteJson(text, self) {
  return text
    .replaceAll(`"${ORIGIN}`, `"${self}`)
    .replaceAll('"/_data/', `"${QUALLA_PREFIX}_data/`)
    .replaceAll('"/_a/', `"${QUALLA_PREFIX}_a/`);
}

async function localJson(path) {
  const file = normalize(join(localRoot, path));
  if (!file.startsWith(localRoot + sep) || !file.endsWith('.json') || !existsSync(file))
    return undefined;
  return readFile(file, 'utf8');
}

/** Serve one `/qualla/…` request. */
export async function proxyQualla(request, response, url) {
  const path = url.pathname.slice(QUALLA_PREFIX.length);
  const self = new URL(QUALLA_PREFIX, url).href;
  const abort = new AbortController();
  response.on('close', () => abort.abort());
  try {
    const range = request.headers.range;
    const upstream = await fetch(`${ORIGIN}${path}${url.search}`, {
      method: request.method === 'HEAD' ? 'HEAD' : 'GET',
      headers: range ? { range } : {},
      signal: abort.signal,
    });
    const json = path.endsWith('.json');
    if (json && upstream.status === 404) {
      const local = await localJson(path);
      if (local !== undefined) {
        const body = rewriteJson(local, self);
        response.writeHead(200, {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body),
          'x-qualla-proxy': 'local',
        });
        response.end(request.method === 'HEAD' ? undefined : body);
        return;
      }
    }
    const headers = { 'x-qualla-proxy': 'upstream' };
    for (const name of FORWARDED) {
      const value = upstream.headers.get(name);
      if (value !== null) headers[name] = value;
    }
    if (json && upstream.ok && request.method !== 'HEAD') {
      const body = rewriteJson(await upstream.text(), self);
      headers['content-length'] = Buffer.byteLength(body);
      delete headers['content-range'];
      response.writeHead(upstream.status, headers);
      response.end(body);
      return;
    }
    // fetch() decodes compressed bodies, so a forwarded length is only right when none was set.
    const length = upstream.headers.get('content-length');
    if (length !== null && upstream.headers.get('content-encoding') === null)
      headers['content-length'] = length;
    response.writeHead(upstream.status, headers);
    if (upstream.body === null || request.method === 'HEAD') response.end();
    // A cancelled range request aborts the upstream body; pipeline settles both sides quietly.
    else pipeline(Readable.fromWeb(upstream.body), response, () => {});
  } catch (error) {
    if (abort.signal.aborted) return;
    if (!response.headersSent) response.writeHead(502, { 'content-type': 'text/plain' });
    response.end(`qualla proxy: ${error instanceof Error ? error.message : String(error)}`);
  }
}
