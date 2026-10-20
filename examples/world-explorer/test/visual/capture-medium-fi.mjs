/** Targeted, hash-bound medium-fi context captures; inspect images before approving. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { structureSourceDirectory } from '../../../../packages/worldgen/scripts/structure-source-paths.mjs';
import { verifyMediumFiRender } from './medium-fi-asset.mjs';

const here = dirname(fileURLToPath(import.meta.url)),
  root = resolve(here, '../../../..');
const ids = process.argv
  .find((a) => a.startsWith('--ids='))
  ?.slice(6)
  .split(',');
if (!ids?.length)
  throw new Error(
    'Usage: node examples/world-explorer/test/visual/capture-medium-fi.mjs --ids=n0259_shanhai_pass',
  );
const { chromium } = createRequire(resolve(root, 'packages/tooling/package.json'))('playwright');
const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
const fixtureHash = hash(
  Buffer.concat(
    await Promise.all(
      ['medium-fi.ts', 'medium-fi.html', 'medium-fi-asset.mjs'].map((p) =>
        readFile(resolve(here, p)),
      ),
    ),
  ),
);
const server = await createServer({
  configFile: false,
  root: here,
  publicDir: false,
  optimizeDeps: { noDiscovery: true },
  define: { __REVIEW_ROOT__: JSON.stringify(root.replaceAll('\\', '/')) },
  server: { host: '127.0.0.1', port: 0, fs: { allow: [root] } },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({
    headless: true,
    args: process.platform === 'win32' ? ['--use-angle=d3d11'] : [],
  });
  for (const id of ids) {
    const dir = structureSourceDirectory(id),
      out = resolve(dir, 'medium-fi'),
      spec = JSON.parse(await readFile(resolve(dir, 'spec.json'))),
      errors = [];
    const pack = JSON.parse(await readFile(resolve(root, 'content/worldgen/stylepack.json'))),
      sidecar = JSON.parse(
        await readFile(resolve(root, 'content/worldgen', pack.assets[spec.assetId])),
      );
    await mkdir(out, { recursive: true });
    const page = await browser.newPage({ viewport: { width: 1200, height: 760 } });
    page.on('pageerror', (e) => errors.push(e.message));
    const { terrain: separateTerrain, ...contextOptions } = spec.mediumFiContext ?? {};
    const context = new URLSearchParams(contextOptions);
    if (process.argv.includes('--reflections')) context.set('reflections', '1');
    const sourceScene = JSON.parse(await readFile(resolve(dir, 'scene.json')));
    const reviewScope = await readFile(resolve(dir, 'review-scope.json'), 'utf8')
      .then(JSON.parse)
      .catch((error) => {
        if (error.code === 'ENOENT') return {};
        throw error;
      });
    const fixtureEntities = (reviewScope.previewEntities ?? []).map((entity) => {
      const rendered = sourceScene.entities.find((candidate) => candidate.id === entity.id);
      if (!rendered || JSON.stringify(rendered) !== JSON.stringify(entity))
        throw new Error(`Stale source-local review surface ${entity.id}`);
      return rendered;
    });
    if (fixtureEntities.length) context.set('fixtureEntities', JSON.stringify(fixtureEntities));
    const terrainFixture = {};
    const reviewTerrain = separateTerrain ?? sourceScene.terrain;
    if (reviewTerrain) {
      for (const key of ['descriptor', 'heightmap']) {
        const file = reviewTerrain[key];
        if (typeof file !== 'string') throw new Error(`Missing terrain ${key}`);
        const local = resolve(dir, file),
          sourceRelative = relative(dir, local).replaceAll('\\', '/');
        if (
          isAbsolute(sourceRelative) ||
          sourceRelative === '..' ||
          sourceRelative.startsWith('../')
        )
          throw new Error('Terrain fixture escapes source');
        context.set(`terrain${key}`, relative(root, local).replaceAll('\\', '/'));
        terrainFixture[key] = { path: file, hash: hash(await readFile(local)) };
      }
    }
    const groundOpening = spec.geographicProposal?.groundCutout?.outline;
    if (groundOpening) {
      context.set('groundOpening', JSON.stringify(groundOpening));
      context.set(
        'additionalGroundOpenings',
        JSON.stringify(spec.geographicProposal.groundCutout.additionalOutlines ?? []),
      );
    }
    await page.goto(
      `http://127.0.0.1:${server.httpServer.address().port}/medium-fi.html?id=${encodeURIComponent(id)}&${context}`,
    );
    await page
      .waitForFunction(() => !!window.mediumFi, undefined, { timeout: 60000 })
      .catch((e) => {
        throw new Error(errors.join('; ') || e.message);
      });
    const frames = [];
    async function shot(name, options) {
      const state = await page.evaluate((o) => window.mediumFi.view(o), options);
      verifyMediumFiRender(sidecar, state);
      if (
        groundOpening &&
        (!state.groundOpening?.active || !state.groundOpening.sourceValuesUnchanged)
      )
        throw new Error('Model-owned opening must be active without changing source elevations');
      if (groundOpening && state.groundOpening.coverage.covered > 0)
        throw new Error('Rendered ground still covers a model-owned opening probe');
      await page.screenshot({ path: resolve(out, `${name}.png`) });
      frames.push({
        path: `medium-fi/${name}.png`,
        hash: hash(await readFile(resolve(out, `${name}.png`))),
        state,
      });
    }
    for (const distance of ['street', 'block', 'skyline'])
      for (const time of ['noon', 'late'])
        for (const mode of ['economy', 'high'])
          await shot(`${distance}-${time}-${mode}`, { distance, time, mode });
    await shot('silhouette', { distance: 'skyline', mode: 'economy', silhouette: true });
    for (const camera of [...spec.qaCameras, ...(spec.qaLodCameras ?? [])])
      await shot(camera.name, {
        position: camera.position,
        lookAt: camera.lookAt,
        level: camera.reviewLod,
      });
    for (const level of ['skyline', 'district', 'street', 'closeup'])
      await shot(`transition-${level}`, { distance: 'block', level });
    const report = {
      format: 'molen/medium-fi-review@1',
      captureVersion: 2,
      assetId: spec.assetId,
      renderedAsset: { assetId: sidecar.id, runtimeHash: sidecar.hash },
      sourceHash: spec.mesh.sha256,
      runtimeHash: sidecar.hash,
      fixtureHash,
      rig: await page.evaluate(() => window.mediumFi.rig),
      neighborTriangles: await page.evaluate(() => window.mediumFi.neighborTriangles),
      runtimeLods: sidecar.runtimeLods.levels,
      terrainFixture,
      fixtureEntities,
      context: reviewTerrain
        ? 'Source-local research hill with synthetic neighbors outside its bounds; not evidence of geographic fit.'
        : `Synthetic procedural neighbors at review Y=${spec.mediumFiContext?.groundY ?? 0}; not evidence of geographic fit.`,
      status: 'captures-pending-inspection',
      frames,
      errors,
    };
    if (errors.length) throw new Error(errors.join('; '));
    await writeFile(resolve(dir, 'medium-fi-report.json'), `${JSON.stringify(report, null, 2)}\n`);
    await page.close();
    console.log(`${id}: ${frames.length} medium-fi frames`);
  }
} finally {
  await browser?.close();
  await server.close();
}
