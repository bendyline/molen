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
  dir = resolve(root, 'content/worldgen/source/places/u2/u2s/n0253_bratislava_castle'),
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
      ['bratislava-grade.ts', 'bratislava-grade.html', 'capture-bratislava-grade.mjs'].map((p) =>
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
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/bratislava-grade.html`, {
    waitUntil: 'networkidle',
  });
  try {
    await page.waitForFunction(() => !!window.bratislavaGradeQA, undefined, { timeout: 15000 });
  } catch (error) {
    throw new Error(`Grade fixture initialization: ${errors.join('; ') || error.message}`);
  }
  const frames = [],
    states = [],
    evictions = [];
  for (const level of ['master', 'skyline', 'district', 'street', 'closeup']) {
    const state = await page.evaluate((l) => window.bratislavaGradeQA.mount(l), level);
    assert.equal(state.placementId, placement.id);
    assert(Number.isFinite(state.modelOriginElevation));
    assert.equal(state.groundCutoutActive, false);
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
      (points) => points.map((p) => window.bratislavaGradeQA.probe(p)),
      [
        [-70, 30],
        [-55, -75],
        [90, 35],
      ],
    );
    for (const p of probes) {
      assert(
        p.clearance !== null && Math.abs(p.clearance) < 0.08,
        'Signed open-ground datum mismatch: ' + JSON.stringify(p),
      );
    }
    const foundations = await page.evaluate(() => window.bratislavaGradeQA.foundationProbes());
    if (level) {
      const missed = foundations.filter((p) => p.distance === null || p.distance > 4.2);
      assert.deepEqual(missed, [], 'Mapped foundation gap at sampled grade');
    }
    const paving = [],
      passages = await page.evaluate(() => window.bratislavaGradeQA.passageProbes());
    assert(
      passages.every((p) => p.distance === null || p.distance > p.required),
      'Four mapped gate tunnels must remain open:' + JSON.stringify({ level, passages }),
    );
    states.push({ ...state, probes, foundations, paving, passages });
    for (const camera of [
      { name: 'whole-castle-on-grade', position: [-320, 200, 250], lookAt: [0, 0, -10] },
      {
        name: 'vienna-mapped-gate-on-grade',
        position: [-111.5156004587297, 2.3804999999999996, -141.51737398309368],
        lookAt: [-122.14032438862861, -0.6195000000000004, -124.57289873558503],
      },
      {
        name: 'sigismund-mapped-gate-on-grade',
        position: [-79.14508152768107, -19.7175, 127.26236304072576],
        lookAt: [-65.98877653971725, -22.7175, 146.87006038931003],
      },
      {
        name: 'nicholas-mapped-gate-on-grade',
        position: [119.50685397670507, -11.805299999999999, -0.013576731051461621],
        lookAt: [136.98842895615434, -14.805299999999999, 18.30990987051794],
      },
      {
        name: 'leopold-mapped-gate-on-grade',
        position: [-161.91896437259464, -3.5119000000000007, -37.753252612926644],
        lookAt: [-147.73001671409392, -6.511900000000001, -12.066625949537638],
      },
    ]) {
      await page.evaluate((c) => window.bratislavaGradeQA.aim(c.position, c.lookAt), camera);
      const path = `shots/grade/${level}-${camera.name}.png`;
      const b = await page.screenshot({ path: `${dir}/${path}` });
      frames.push({ ...camera, level, path, hash: hashBytes(b) });
    }
    const eviction = await page.evaluate(() => window.bratislavaGradeQA.unload());
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
        candidateId: 'N0253',
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
