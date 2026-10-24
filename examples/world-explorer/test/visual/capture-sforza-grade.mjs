/** Render public Terrarium numeric heights through normal signed landmark placement. */
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
  dir = resolve(root, 'content/worldgen/source/places/u0/u0n/sforza_castle'),
  runtime = dir.replace('/source/', '/assets/').replace('\\source\\', '\\assets\\');
const read = async (p) => JSON.parse(await readFile(p)),
  spec = await read(`${dir}/spec.json`),
  asset = await read(`${runtime}/asset.json`),
  grade = await read(`${dir}/site-grade.json`),
  placements = await read(resolve(root, 'content/earth/structures/placements/authoring.json')),
  placement = placements.entries.find((p) => p.asset === spec.assetId),
  inputHash = await modelInputHash(dir, spec.assetId);
const fixtureHash = hashBytes(
  Buffer.concat(
    await Promise.all(
      ['sforza-grade.ts', 'sforza-grade.html', 'capture-sforza-grade.mjs'].map((p) =>
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
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/sforza-grade.html`, {
    waitUntil: 'networkidle',
  });
  try {
    await page.waitForFunction(() => !!window.sforzaGradeQA, undefined, { timeout: 15000 });
  } catch (error) {
    throw new Error(`Grade fixture initialization: ${errors.join('; ') || error.message}`);
  }
  const frames = [],
    states = [],
    evictions = [];
  for (const level of ['master', 'skyline', 'district', 'street', 'closeup']) {
    const state = await page.evaluate((l) => window.sforzaGradeQA.mount(l), level);
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
      Math.abs(state.modelOriginElevation) < 0.0001,
      'Retained terrain/model reference mismatch: ' + JSON.stringify(state),
    );
    const probes = await page.evaluate(
      (points) => points.map((p) => window.sforzaGradeQA.probe(p)),
      [
        [-145, -140],
        [140, 135],
        [-140, 90],
      ],
    );
    for (const p of probes) {
      assert(
        p.clearance !== null && Math.abs(p.clearance) < 0.08,
        'Signed open-ground datum mismatch: ' + JSON.stringify(p),
      );
    }
    const foundations = await page.evaluate(() => window.sforzaGradeQA.foundationProbes());
    if (level) {
      const missed = foundations.filter((p) => p.distance === null || p.distance > 4.2);
      assert.deepEqual(missed, [], 'Mapped foundation gap at sampled grade');
    }
    const moat = await page.evaluate(() => window.sforzaGradeQA.moatProbe());
    assert.equal(moat.activeGround, null, 'Moat must open retained ground');
    assert(
      Number.isFinite(moat.originalGround),
      'Original numeric ground must be retained for unload',
    );
    assert(
      Math.abs(moat.modelFloor - moat.expectedFloor) < 0.001,
      'Open moat must have complete model floor',
    );
    const paving = [],
      passages = await page.evaluate(() => window.sforzaGradeQA.passageProbes());
    assert(
      passages.every((p) => p.distance === null || p.distance > p.required),
      'Signed Sforza gatehouse must remain open:' + JSON.stringify({ level, passages }),
    );
    states.push({ ...state, probes, foundations, paving, passages, moat });
    for (const camera of [
      { name: 'whole-castle-and-retained-ground', position: [260, 175, 330], lookAt: [-7, 22, 0] },
      { name: 'front-bridge-and-open-gate', position: [-6.7, 8, 125], lookAt: [-6.7, 7, 82] },
      { name: 'west-moat-and-gate', position: [-135, 14, 65], lookAt: [-100.5, 3, 42.3] },
      { name: 'ponticella-supported-gallery', position: [149, 31, -118], lookAt: [88, 17, -80] },
      { name: 'rocchetta-court', position: [-69, 24, -46], lookAt: [-52, 8, -68] },
      { name: 'open-belfry-and-loggia', position: [32, 69, 133], lookAt: [-6.7, 55, 82] },
      { name: 'court-facing-trifora', position: [-16, 24, 45], lookAt: [-6.7, 18, 73.4] },
      {
        name: 'inside-west-moat-floor-and-walls',
        position: [-111, -1.5, 55],
        lookAt: [-111, -0.5, -20],
      },
    ]) {
      await page.evaluate((c) => window.sforzaGradeQA.aim(c.position, c.lookAt), camera);
      const path = `shots/grade/${level}-${camera.name}.png`;
      const b = await page.screenshot({ path: `${dir}/${path}` });
      frames.push({ ...camera, level, path, hash: hashBytes(b) });
    }
    const eviction = await page.evaluate(() => window.sforzaGradeQA.unload());
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
        candidateId: 'sforza_castle',
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
