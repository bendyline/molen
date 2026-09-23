import { createServer as createHttpServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const examplesRoot = resolve(here, '..');
const host = process.env.HOST ?? 'localhost';
const port = Number(process.env.PORT ?? 5225);
const exampleNames = [
  'world-explorer',
  'lantern-dungeon',
  'city-courier',
  'skybound',
  'top-down-arena',
  'terrain-flyover',
  'data-viz',
  'cubes',
  'figures-gallery',
];

const viteServers = new Map();
const httpServer = createHttpServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  const exampleName = exampleNames.find(
    (name) => url.pathname === `/${name}` || url.pathname.startsWith(`/${name}/`),
  );

  if (exampleName !== undefined && url.pathname === `/${exampleName}`) {
    response.writeHead(308, { location: `/${exampleName}/${url.search}` });
    response.end();
    return;
  }

  const vite = viteServers.get(exampleName ?? 'home');
  if (vite === undefined) {
    response.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('The example server is still starting.');
    return;
  }

  vite.middlewares(request, response, () => {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Example not found.');
  });
});

async function addViteServer(name, root, base, configFile = false) {
  const vite = await createViteServer({
    root,
    base,
    configFile,
    appType: 'spa',
    clearScreen: false,
    server: {
      middlewareMode: true,
      hmr: { server: httpServer, path: '__vite_hmr' },
    },
  });
  viteServers.set(name, vite);
}

await addViteServer('home', here, '/');
for (const name of exampleNames) {
  await addViteServer(
    name,
    resolve(examplesRoot, name),
    `/${name}/`,
    resolve(examplesRoot, name, 'vite.config.ts'),
  );
}

httpServer.on('error', (error) => {
  console.error(error);
  process.exitCode = 1;
});

httpServer.listen(port, host, () => {
  console.log(`\n  Molen examples  http://${host}:${port}/\n`);
});

async function close() {
  httpServer.close();
  await Promise.all([...viteServers.values()].map((vite) => vite.close()));
}

process.once('SIGINT', () => void close().finally(() => process.exit(0)));
process.once('SIGTERM', () => void close().finally(() => process.exit(0)));
