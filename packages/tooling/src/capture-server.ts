import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.png': 'image/png',
  '.bin': 'application/octet-stream',
  '.wasm': 'application/wasm',
};

export interface CaptureServer {
  /** Origin, e.g. "http://127.0.0.1:52341". */
  url: string;
  close(): Promise<void>;
}

interface AsyncClosable {
  close(): Promise<void>;
}

/** Start browser + HTTP server as one resource transaction; clean up either orphan on failure. */
export async function startCaptureResources<TBrowser extends AsyncClosable>(
  startBrowser: () => Promise<TBrowser>,
  captureRoot: string,
  filesRoot?: string,
  startServer: (
    captureRoot: string,
    filesRoot?: string,
  ) => Promise<CaptureServer> = startCaptureServer,
): Promise<{ browser: TBrowser; server: CaptureServer }> {
  const browserPromise = startBrowser();
  const serverPromise = startServer(captureRoot, filesRoot);
  try {
    const [browser, server] = await Promise.all([browserPromise, serverPromise]);
    return { browser, server };
  } catch (error) {
    const settled = await Promise.allSettled([browserPromise, serverPromise]);
    const closes: Promise<void>[] = [];
    const browser = settled[0];
    const server = settled[1];
    if (browser?.status === 'fulfilled') closes.push(browser.value.close());
    if (server?.status === 'fulfilled') closes.push(server.value.close());
    await Promise.allSettled(closes);
    throw error;
  }
}

/**
 * Ephemeral-port localhost static server for the capture path. Chromium blocks fetch() on
 * file:// pages, so gltf assets (and future decoder files) must be served over HTTP:
 *   /            -> dist/capture (capture.html + harness.js)
 *   /files/**    -> filesRoot (the project/scene directory), when configured
 */
export async function startCaptureServer(
  captureRoot: string,
  filesRoot?: string,
): Promise<CaptureServer> {
  const captureRootReal = await realpath(captureRoot);
  const filesRootReal = filesRoot !== undefined ? await realpath(filesRoot) : undefined;
  const safeJoin = (root: string, rel: string): string | undefined => {
    const rootAbs = normalize(root).replace(/[\\/]+$/, '');
    const abs = normalize(join(rootAbs, rel));
    return abs.startsWith(rootAbs + sep) || abs === rootAbs ? abs : undefined;
  };

  const decode = (value: string): string | undefined => {
    try {
      return decodeURIComponent(value);
    } catch {
      return undefined;
    }
  };

  const server: Server = createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      let filePath: string | undefined;
      let allowedRoot: string | undefined;
      if (url.pathname.startsWith('/files/')) {
        const rel = decode(url.pathname.slice('/files/'.length));
        if (filesRootReal !== undefined && rel !== undefined) {
          allowedRoot = filesRootReal;
          filePath = safeJoin(filesRootReal, rel);
        }
      } else {
        const rel = url.pathname === '/' ? 'capture.html' : decode(url.pathname.slice(1));
        if (rel !== undefined) {
          allowedRoot = captureRootReal;
          filePath = safeJoin(captureRootReal, rel);
        }
      }
      if (filePath === undefined || allowedRoot === undefined) {
        res.writeHead(404).end('not found');
        return;
      }
      try {
        const resolvedFile = await realpath(filePath);
        if (safeJoin(allowedRoot, relativeFromRoot(allowedRoot, resolvedFile)) !== resolvedFile) {
          throw new Error('path escaped root through a symlink');
        }
        const info = await stat(resolvedFile);
        if (!info.isFile()) throw new Error('not a file');
        res.writeHead(200, {
          'content-type': MIME[extname(resolvedFile).toLowerCase()] ?? 'application/octet-stream',
          'content-length': info.size,
        });
        const stream = createReadStream(resolvedFile);
        stream.on('error', () => res.destroy());
        stream.pipe(res);
      } catch {
        res.writeHead(404).end('not found');
      }
    })();
  });

  try {
    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error): void => reject(error);
      server.once('error', onError);
      server.listen(0, '127.0.0.1', () => {
        server.off('error', onError);
        resolve();
      });
    });
  } catch (error) {
    server.close();
    throw error;
  }
  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((e) => (e ? reject(e) : resolve()));
      }),
  };
}

function relativeFromRoot(root: string, path: string): string {
  if (path === root) return '';
  const prefix = root.endsWith(sep) ? root : `${root}${sep}`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : `..${sep}outside`;
}
