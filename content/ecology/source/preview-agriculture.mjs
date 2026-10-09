// Reproducible browser captures of the real agricultural shader, scatter and procedural plants.
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const out = resolve(root, '.artifacts/regional-world/agriculture');
await mkdir(out, { recursive: true });
await writeFile(
  resolve(out, 'index.html'),
  `<!doctype html><meta charset="utf-8"><title>Agricultural field review</title><style>body{margin:0;background:#c7d8de}#caption{position:absolute;top:20px;left:24px;font:16px system-ui;color:#293b34;background:#ffffffdd;padding:12px 16px;border-radius:8px}</style><div id="caption"></div><script type="module" src="/content/ecology/source/agriculture-preview-client.mjs"></script>`,
);
const require = createRequire(resolve(root, 'examples/world-explorer/package.json'));
const { createServer } = await import(pathToFileURL(require.resolve('vite')).href);
const { chromium } = createRequire(resolve(root, 'packages/tooling/package.json'))('playwright');
const server = await createServer({
  root,
  server: { host: '127.0.0.1', port: 0 },
  optimizeDeps: { noDiscovery: true, include: ['three', 'three/webgpu'] },
});
let browser;
const evidence = [];
try {
  await server.listen();
  browser = await chromium.launch({
    headless: true,
    args: process.platform === 'win32' ? ['--use-angle=d3d11'] : [],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  for (const backend of ['webgl', 'nodes']) {
    await page.goto(
      `http://127.0.0.1:${server.httpServer.address().port}/.artifacts/regional-world/agriculture/index.html?backend=${backend}`,
    );
    await page.waitForFunction(() => window.farmReady, undefined, { timeout: 60000 });
    const frames =
      backend === 'nodes'
        ? [['iowa', undefined, 'air', 'high', false]]
        : [
            ...['iowa', 'italy', 'india', 'brazil', 'kenya', 'australia'].map((name) => [
              name,
              undefined,
              'air',
              'high',
              false,
            ]),
            ['iowa', undefined, 'near', 'high', false],
            ['iowa', undefined, 'wide', 'economy', false],
            ['iowa', 4, 'air', 'high', false],
            ['iowa', 7, 'air', 'high', false],
            ['iowa', 9, 'air', 'high', false],
            ['iowa', 12, 'air', 'high', false],
            ['iowa', undefined, 'air', 'high', true],
            ['india', undefined, 'air', 'high', true],
          ];
    for (const args of frames) {
      const result = await page.evaluate((args) => window.showFarm(...args), args);
      const name = `${backend}-${args[0]}-${args[1] ?? 'mature'}-${args[2]}-${args[3]}-${args[4] ? 'inferred' : 'mapped'}`;
      await page.screenshot({ path: resolve(out, `${name}.png`) });
      evidence.push({ ...result, frame: `${name}.png` });
    }
  }
  if (errors.length) throw new Error(errors.join('\n'));
  await writeFile(resolve(out, 'evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
  await import('./build-agriculture-review.mjs');
  console.log(JSON.stringify({ frames: evidence.length, errors }));
} finally {
  await browser?.close();
  await server.close();
}
