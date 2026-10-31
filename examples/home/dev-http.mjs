import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream';

function parseRange(value, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (!match || (match[1] === '' && match[2] === '')) return undefined;
  let start;
  let end;
  if (match[1] === '') {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return undefined;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === '' ? size - 1 : Number(match[2]);
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || end < start)
    return undefined;
  return { start, end: Math.min(end, size - 1) };
}

/** Vite 6's public-file server misreads suffix ranges and throws on reversed ranges. */
export function publicArchiveRanges(publicDir, base) {
  return (request, response, next) => {
    if (!publicDir || !request.headers.range) return next();
    void (async () => {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      if (!pathname.startsWith(base)) return next();
      const root = resolve(publicDir);
      const file = resolve(root, pathname.slice(base.length));
      if (!file.startsWith(root + sep) || !['.zip', '.pmtiles'].includes(extname(file)))
        return next();
      let info;
      try {
        info = await stat(file);
      } catch (error) {
        if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return next();
        throw error;
      }
      if (!info.isFile()) return next();
      // Range only applies to GET. Without a strong validator, an If-Range request must
      // receive a full response; let Vite handle both cases without its range parser.
      if (request.method !== 'GET' || request.headers['if-range']) {
        delete request.headers.range;
        return next();
      }
      const range = parseRange(request.headers.range, info.size);
      if (!range) {
        response.writeHead(416, { 'content-range': `bytes */${info.size}` });
        response.end();
        return;
      }
      const { start, end } = range;
      response.writeHead(206, {
        'accept-ranges': 'bytes',
        'cache-control': 'no-store',
        'content-type': extname(file) === '.zip' ? 'application/zip' : 'application/octet-stream',
        'content-length': end - start + 1,
        'content-range': `bytes ${start}-${end}/${info.size}`,
      });
      // pipeline closes the file on cancellation and destroys the response on a read error.
      pipeline(createReadStream(file, { start, end }), response, () => {});
    })().catch(next);
  };
}

/** Connect can fall through with an error after a middleware has already sent headers. */
export function finishViteRequest(response, error) {
  if (response.writableEnded || response.destroyed) return;
  if (response.headersSent) {
    response.destroy();
    return;
  }
  response.removeHeader('content-length');
  response.removeHeader('content-range');
  response.writeHead(error ? 500 : 404, { 'content-type': 'text/plain; charset=utf-8' });
  response.end(error ? 'Example request failed.' : 'Example not found.');
}
