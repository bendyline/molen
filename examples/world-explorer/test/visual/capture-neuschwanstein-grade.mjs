/** Render retained public DGM1 ridge data through normal signed landmark placement. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import {
  hashBytes,
  modelInputHash,
} from '../../../../packages/worldgen/scripts/structure-model-files.mjs';

const here = dirname(fileURLToPath(import.meta.url)),
  root = resolve(here, '../../../..'),
  dir = resolve(root, 'content/worldgen/source/places/u0/u0r/n0237_neuschwanstein_castle'),
  runtime = dir.replace('/source/', '/assets/').replace('\\source\\', '\\assets\\');
const read = async (p) => JSON.parse(await readFile(p)),
  spec = await read(`${dir}/spec.json`),
  asset = await read(`${runtime}/asset.json`),
  grade = await read(`${dir}/site-grade.json`),
  placements = await read(resolve(root, 'content/earth/structures/placements.json')),
  placement = placements.entries.find((p) => p.asset === spec.assetId),
  inputHash = await modelInputHash(dir, spec.assetId);
const fixtureHash = hashBytes(
  Buffer.concat(
    await Promise.all(
      [
        'neuschwanstein-grade.ts',
        'neuschwanstein-grade.html',
        'capture-neuschwanstein-grade.mjs',
      ].map((p) => readFile(resolve(here, p))),
    ),
  ),
);
const { chromium } = createRequire(resolve(root, 'packages/tooling/package.json'))('playwright');
const server = await createServer({
  configFile: false,
  root: here,
  publicDir: false,
  define: {
    __LANDMARK_CONTENT_ROOT__: JSON.stringify(resolve(root, 'content').replaceAll('\\', '/')),
  },
  server: { host: '127.0.0.1', port: 0, fs: { allow: [root] } },
});
let browser;
const errors = [];
await mkdir(`${dir}/shots/grade`, { recursive: true });
try {
  await server.listen();
  browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1080 },
    deviceScaleFactor: 1,
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(
    `http://127.0.0.1:${server.httpServer.address().port}/neuschwanstein-grade.html`,
    {
      waitUntil: 'networkidle',
    },
  );
  try {
    await page.waitForFunction(() => !!window.neuschwansteinGradeQA, undefined, { timeout: 15000 });
  } catch (error) {
    throw new Error(`Grade fixture initialization: ${errors.join('; ') || error.message}`);
  }
  const frames = [],
    states = [],
    evictions = [];
  for (const level of ['master', 'skyline', 'district', 'street', 'closeup']) {
    const state = await page.evaluate((l) => window.neuschwansteinGradeQA.mount(l), level);
    assert.equal(state.placementId, placement.id);
    assert(Math.abs(state.modelOriginElevation) < 1e-6);
    assert.equal(state.groundCutoutActive, true);
    assert(state.terrainSamples.some((s) => Math.abs(s.height - 1) < 0.001));
    const probes = await page.evaluate(
      (points) => points.map((p) => window.neuschwansteinGradeQA.probe(p)),
      [grade.terrainReferenceNative, [18, 8.2, 3], [48, 1, 3]],
    );
    for (const p of probes) {
      assert(
        p.clearance !== null &&
          Math.abs(p.clearance) < 0.08 &&
          p.floorError !== null &&
          Math.abs(p.floorError) < 0.03,
        'Model floor/contact mismatch',
      );
      assert.equal(p.terrainVisibleInsideCourt, false);
    }
    states.push({ ...state, probes });
    for (const camera of [
      { name: 'whole-southern-ridge', position: [-135, 76, 160], lookAt: [-10, 22, 2] },
      { name: 'north-stepped-foundations', position: [-20, 40, -145], lookAt: [-5, 16, -7] },
      { name: 'gateway-road-contact', position: [100, 9, 14], lookAt: [57, 7, 3.4] },
      { name: 'seven-metre-court-step', position: [49, 4, 1], lookAt: [43, 5, -8.2] },
      { name: 'upper-court-contact', position: [26, 13, 8], lookAt: [-7, 14, 3] },
    ]) {
      await page.evaluate((c) => window.neuschwansteinGradeQA.aim(c.position, c.lookAt), camera);
      const path = `shots/grade/${level}-${camera.name}.png`;
      const b = await page.screenshot({ path: `${dir}/${path}` });
      frames.push({ ...camera, level, path, hash: hashBytes(b) });
    }
    const eviction = await page.evaluate(() => window.neuschwansteinGradeQA.unload());
    assert.equal(eviction.liveModelGeometries, 0);
    assert.equal(eviction.groundRestored, true);
    evictions.push({ level, ...eviction });
  }
  assert.deepEqual(errors, []);
  await writeFile(
    `${dir}/shots/grade/report.json`,
    `${JSON.stringify(
      {
        format: 'molen/structure-grade-review@1',
        candidateId: 'N0237',
        status: 'awaiting-actual-image-inspection',
        inputHash,
        sourceHash: spec.mesh.sha256,
        runtimeHash: asset.hash,
        placementHash: hashBytes(JSON.stringify(placement)),
        fixtureHash,
        gradeHash: hashBytes(await readFile(`${dir}/site-grade.json`)),
        runtimeLods: asset.runtimeLods.levels,
        states,
        evictions,
        frames,
        errors,
        limits: grade.limits,
      },
      null,
      2,
    )}\n`,
  );
  console.log(
    JSON.stringify({
      frames: frames.length,
      contactClearances: states[0].probes.map((p) => p.clearance),
      evicted: evictions.length,
    }),
  );
} finally {
  await browser?.close();
  await server.close();
}
