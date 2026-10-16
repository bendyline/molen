/** Local rendered evidence of posed wildlife, independent of bind-pose asset captures. */
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const require = createRequire(resolve(root, 'examples/world-explorer/package.json'));
const { createServer } = await import(pathToFileURL(require.resolve('vite')).href);
const { chromium } = createRequire(resolve(root, 'packages/tooling/package.json'))('playwright');
const out = resolve(
  root,
  `.artifacts/regional-world/${process.argv.includes('--diversity') ? 'wildlife-motion-diversity' : 'wildlife-motion'}`,
);
await mkdir(out, { recursive: true });
const server = await createServer({
  configFile: false,
  root,
  plugins: [
    {
      name: 'wildlife-review-page',
      configureServer(server) {
        server.middlewares.use('/__wildlife_review', (_req, res) => {
          res.setHeader('Content-Type', 'text/html');
          res.end(
            '<!doctype html><head><link rel="icon" href="data:,"></head><body><script type="module" src="/content/wildlife/source/motion-scene.mjs"></script></body>',
          );
        });
      },
    },
  ],
  optimizeDeps: { entries: ['content/wildlife/source/motion-scene.mjs'] },
  server: { host: '127.0.0.1', port: 0, fs: { allow: [root] } },
});
let browser;
const evidence = { errors: [], cases: [] };
try {
  await server.listen();
  const address = server.httpServer.address();
  browser = await chromium.launch({
    headless: true,
    args: process.platform === 'win32' ? ['--use-angle=d3d11'] : [],
  });
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  page.on('pageerror', (error) => evidence.errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      evidence.errors.push(message.text());
      console.error(message.text());
    }
  });
  page.on('requestfailed', (request) =>
    console.error(`Request failed: ${request.url()} ${request.failure()?.errorText}`),
  );
  await page.goto(`http://127.0.0.1:${address.port}/__wildlife_review`);
  await page.waitForFunction(() => typeof window.wildlifeReview === 'function', undefined, {
    timeout: 60000,
  });
  const names = process.argv
    .filter((arg) => arg.startsWith('--animal='))
    .map((arg) => arg.slice(9));
  if (!names.length)
    names.push(
      'roe_deer',
      'red_fox',
      'red_kangaroo',
      'savanna_elephant',
      'woodland_songbird',
      'waterfowl_group',
      'wading_bird_group',
      'warm_ground_lizard',
      'freshwater_fish_group',
      'flower_visiting_insect',
      'red_squirrel',
      'european_hare',
    );
  for (const name of names) {
    const poses = [];
    for (const ticks of [0, 11, 23]) {
      const state = await page.evaluate(({ name, ticks }) => window.wildlifeReview(name, ticks), {
        name,
        ticks,
      });
      poses.push(state.matrices);
      delete state.matrices;
      if (!state.finitePose || state.animals !== 1)
        throw new Error(`Invalid motion state: ${JSON.stringify(state)}`);
      await page.screenshot({ path: resolve(out, `${name}-${ticks}.png`) });
      evidence.cases.push(state);
    }
    if (JSON.stringify(poses[0]) === JSON.stringify(poses[2]))
      throw new Error(`No animated pose change: ${name}`);
    console.log(`${name}: three finite, changing poses captured`);
  }
} finally {
  await browser?.close();
  await server.close();
  await writeFile(resolve(out, 'evidence.json'), JSON.stringify(evidence, null, 2));
}
if (evidence.errors.length) throw new Error(evidence.errors.join('\n'));
