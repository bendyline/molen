/** Render retained public Scottish Phase5 DTM bare-earth data through normal signed landmark placement. */
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
  dir = resolve(root, 'content/worldgen/source/places/gc/gcv/n0242_edinburgh_castle'),
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
      ['edinburgh-grade.ts', 'edinburgh-grade.html', 'capture-edinburgh-grade.mjs'].map((p) =>
        readFile(resolve(here, p)),
      ),
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
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/edinburgh-grade.html`, {
    waitUntil: 'networkidle',
  });
  try {
    await page.waitForFunction(() => !!window.edinburghGradeQA, undefined, { timeout: 15000 });
  } catch (error) {
    throw new Error(`Grade fixture initialization: ${errors.join('; ') || error.message}`);
  }
  const frames = [],
    states = [],
    evictions = [];
  for (const level of ['master', 'skyline', 'district', 'street', 'closeup']) {
    const state = await page.evaluate((l) => window.edinburghGradeQA.mount(l), level);
    assert.equal(state.placementId, placement.id);
    assert(Number.isFinite(state.modelOriginElevation));
    assert.equal(state.groundCutoutActive, true);
    assert(state.terrainSamples.length === 1);
    assert(
      Math.abs(
        state.modelOriginElevation -
          (state.terrainSamples[0].height - placement.terrainReference.modelHeight),
      ) < 1e-6,
    );
    assert(
      Math.abs(state.modelOriginElevation) < 1e-6,
      'Retained terrain/model reference mismatch',
    );
    const probes = await page.evaluate(
      (points) => points.map((p) => window.edinburghGradeQA.probe(p)),
      [
        [51, 27],
        [-93, -30],
        [-30, 15],
      ],
    );
    for (const p of probes) {
      assert(
        p.clearance !== null && Math.abs(p.clearance) < 0.08,
        'Signed open-ground datum mismatch',
      );
    }
    const foundations = await page.evaluate(() => window.edinburghGradeQA.foundationProbes());
    if (['master', 'street', 'closeup'].includes(level)) {
      const missed = foundations.filter((p) => p.distance === null || p.distance > 4.2);
      assert.deepEqual(missed, [], 'Mapped foundation gap at sampled grade');
    }
    const paving = await page.evaluate(() => window.edinburghGradeQA.pavingProbes());
    assert(
      paving.every(
        (p) =>
          p.floorError !== null && Math.abs(p.floorError) < 0.03 && !p.terrainVisibleBelowPaving,
      ),
    );
    const passages = await page.evaluate(() => window.edinburghGradeQA.passageProbes());
    assert(
      passages.every(
        (p) => p.floorError !== null && Math.abs(p.floorError) < 0.03 && p.terrainMasked,
      ),
      'Gate road floor or mask mismatch: ' + JSON.stringify({ level, passages }),
    );
    states.push({ ...state, probes, foundations, paving, passages });
    for (const camera of [
      { name: 'castle-rock-overview', position: [210, 110, 170], lookAt: [0, 17, 0] },
      { name: 'crown-square-and-clock', position: [48, 22.8, 30], lookAt: [72, 33, 28] },
      { name: 'hospital-square', position: [-90, 19, -16], lookAt: [-93, 9, -30] },
      { name: 'barracks-and-western-cliff', position: [-135, 35, 95], lookAt: [-36, 15, 40] },
      { name: 'half-moon-battery', position: [130, 35, 0], lookAt: [78, 25, 9] },
      { name: 'east-gate-and-portcullis', position: [138, 12, -47], lookAt: [97, 6, -24] },
      {
        name: 'drawbridge-through-open-entrance',
        position: [124, 3, -33],
        lookAt: [106.54, 2.5, -25.61],
      },
    ]) {
      await page.evaluate((c) => window.edinburghGradeQA.aim(c.position, c.lookAt), camera);
      const path = `shots/grade/${level}-${camera.name}.png`;
      const b = await page.screenshot({ path: `${dir}/${path}` });
      frames.push({ ...camera, level, path, hash: hashBytes(b) });
    }
    const eviction = await page.evaluate(() => window.edinburghGradeQA.unload());
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
        candidateId: 'N0242',
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
        limits: grade.limitations,
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
