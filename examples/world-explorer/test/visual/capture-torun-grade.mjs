/** Render the published relative retaining/slope interpretation through normal placement. */
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
  dir = resolve(root, 'content/worldgen/source/places/u3/u3m/n0595_leaning_tower_of_torun'),
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
      ['torun-grade.ts', 'torun-grade.html', 'capture-torun-grade.mjs'].map((p) =>
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
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/torun-grade.html`, {
    waitUntil: 'networkidle',
  });
  await page.waitForFunction(() => !!window.torunGradeQA, undefined, { timeout: 60000 });
  const frames = [],
    states = [],
    evictions = [];
  for (const level of ['master', 'skyline', 'district', 'street', 'closeup']) {
    const state = await page.evaluate((l) => window.torunGradeQA.mount(l), level);
    assert.equal(state.placementId, placement.id);
    assert(Math.abs(state.modelOriginElevation) < 1e-6);
    assert(state.terrainSamples.some((s) => s.height === 4));
    const lean = [
        (1.46 * Math.sin(placement.heading)) / 15,
        (-1.46 * Math.cos(placement.heading)) / 15,
      ],
      south = [-3.62 + lean[0] * -4 + 0.022 * 6.94, 0, 6.94 + lean[1] * -4],
      stairZ = -2.6 + lean[1] * 2.8,
      stairX = 5.78 + lean[0] * 2.8 + 0.022 * -2.6 + 4.03;
    const probes = await page.evaluate(
      (points) => points.map((p) => window.torunGradeQA.probe(p)),
      [grade.terrainReferenceNative, south, [stairX, 4.05, stairZ]],
    );
    for (const p of probes)
      assert(p.clearance !== null && p.clearance >= 0 && p.clearance < 0.08, 'Contact mismatch');
    states.push({ ...state, probes });
    for (const camera of [
      { name: 'north-street', position: [-17, 12, -25], lookAt: [-1, 10, -4] },
      { name: 'south-foundation', position: [20, 9, 28], lookAt: [0, 5, 4] },
      { name: 'east-stair-foot', position: [19, 8, -9], lookAt: [7, 5, -3] },
      { name: 'west-gallery', position: [-24, 13, -23], lookAt: [-8, 7, -4] },
    ]) {
      await page.evaluate((c) => window.torunGradeQA.aim(c.position, c.lookAt), camera);
      const path = `shots/grade/${level}-${camera.name}.png`;
      const b = await page.screenshot({ path: `${dir}/${path}` });
      frames.push({ ...camera, level, path, hash: hashBytes(b) });
    }
    const eviction = await page.evaluate(() => window.torunGradeQA.unload());
    assert.equal(eviction.liveModelGeometries, 0);
    evictions.push({ level, ...eviction });
  }
  assert.deepEqual(errors, []);
  await writeFile(
    `${dir}/shots/grade/report.json`,
    `${JSON.stringify(
      {
        format: 'molen/structure-grade-review@1',
        candidateId: 'N0595',
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
