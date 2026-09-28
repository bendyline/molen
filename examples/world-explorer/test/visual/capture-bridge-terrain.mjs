/** Review current bridge placements against preserved real terrain, without fitting either. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { structureSourceDirectory } from '../../../../packages/worldgen/scripts/structure-source-paths.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const pack = JSON.parse(await readFile(resolve(root, 'content/worldgen/stylepack.json'), 'utf8'));
const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const require = createRequire(resolve(root, 'packages/tooling/package.json'));
const { chromium } = require('playwright');
const ids = (
  process.argv.find((arg) => arg.startsWith('--ids='))?.slice(6) ?? 'N0011,N0012,N0014'
).split(',');
const terrainSet = process.argv.find((arg) => arg.startsWith('--terrain-set='))?.slice(14) ?? '';
const reviewRoads = process.argv.includes('--with-roads');
const suffix = reviewRoads ? '-roads' : '';
if (terrainSet && !['copernicus', 'ign', 'gsi', 'gugik'].includes(terrainSet))
  throw new Error('Unknown terrain evidence set');
const output = resolve(root, 'content/earth/structures/evidence/bridge-terrain', terrainSet);
const fixtureHash = hash(
  Buffer.concat(
    await Promise.all(
      ['bridge-terrain-fit.ts', 'bridge-terrain-fit.html', 'terrain-evidence-sampling.ts'].map(
        (name) => readFile(resolve(here, name)),
      ),
    ),
  ),
);
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
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(
    `http://127.0.0.1:${server.httpServer.address().port}/bridge-terrain-fit.html?terrainSet=${terrainSet}&roads=${reviewRoads ? 1 : 0}`,
    {
      waitUntil: 'networkidle',
    },
  );
  await page.waitForFunction(() => !!window.bridgeTerrainQA, undefined, { timeout: 120000 });
  for (const id of ids) {
    const evidenceBytes = await readFile(resolve(output, `${id}.json`));
    const evidence = JSON.parse(evidenceBytes);
    const source = structureSourceDirectory(evidence.modelFolder);
    assert.equal(
      hash(await readFile(resolve(source, 'spec.json'))),
      evidence.specHash,
      `${id}: regenerate terrain evidence for current spec`,
    );
    const spec = JSON.parse(await readFile(resolve(source, 'spec.json')));
    const sidecarPath = pack.assets[spec.assetId];
    assert(sidecarPath, `${id}: runtime asset is not registered`);
    const asset = resolve(root, 'content/worldgen', dirname(sidecarPath));
    const sourceHash = hash(await readFile(resolve(source, 'models/source.glb')));
    const sidecar = JSON.parse(await readFile(resolve(root, 'content/worldgen', sidecarPath)));
    assert.equal(sidecar.sourceHash, sourceHash, `${id}: import current source first`);
    const runtimeHash = hash(await readFile(resolve(asset, sidecar.files.main)));
    assert.equal(sidecar.hash, runtimeHash);
    const state = await page.evaluate((candidate) => window.bridgeTerrainQA.mount(candidate), id);
    const half =
      evidence.reviewHalfLength ??
      (id === 'N0011'
        ? 62
        : id === 'N0012'
          ? 11
          : (spec.actualBounds.max[0] - spec.actualBounds.min[0]) / 2);
    const deck =
      evidence.reviewDeckHeight ??
      (id === 'N0011'
        ? 9
        : id === 'N0012'
          ? 4
          : id === 'N0014'
            ? 34
            : spec.actualBounds.max[1] * 0.6);
    const range = evidence.reviewCameraRange ?? half * 3.8;
    const cameras = [
      {
        name: 'bank-oblique',
        position: [range * 0.45, deck + range * 0.48, range * 0.75],
        lookAt: [0, deck * 0.3, 0],
      },
      { name: 'side-elevation', position: [0, deck * 0.55, range], lookAt: [0, deck * 0.55, 0] },
      {
        name: 'reverse-bank',
        position: [-range * 0.5, deck + range * 0.35, -range * 0.75],
        lookAt: [0, deck * 0.3, 0],
      },
      { name: 'plan', position: [0, range, 0.001], lookAt: [0, 0, 0] },
      ...(evidence.reviewAdditionalCameras ?? []),
    ];
    const frames = [];
    await mkdir(resolve(output, 'shots', id + suffix), { recursive: true });
    for (const camera of cameras) {
      const fov = evidence.reviewCameraFov ?? 38;
      const pose = await page.evaluate(
        (view) => window.bridgeTerrainQA.aim(view.position, view.lookAt, view.fov),
        { ...camera, fov },
      );
      const path = `shots/${id}${suffix}/${camera.name}.png`;
      const bytes = await page.screenshot({ path: resolve(output, path) });
      frames.push({ ...camera, fov, pose, path, hash: hash(bytes) });
    }
    const stations = [
      -half + 0.5,
      -half * 0.75,
      -half * 0.5,
      0,
      half * 0.5,
      half * 0.75,
      half - 0.5,
    ];
    const centerline =
      id === 'N0011'
        ? JSON.parse(await readFile(resolve(source, 'map-frame.json'))).centerline
        : [
            [-half, 0],
            [half, 0],
          ];
    const points =
      evidence.reviewProbePoints ??
      stations.map((x) => {
        const index = Math.max(
          1,
          centerline.findIndex((point) => point[0] >= x),
        );
        const a = centerline[index - 1],
          b = centerline[index];
        return [x, a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0])];
      });
    const probes = await page.evaluate(
      (points) => points.map(([x, z]) => window.bridgeTerrainQA.probe(x, z)),
      points,
    );
    const eviction = await page.evaluate(() => window.bridgeTerrainQA.unload());
    assert.equal(eviction.liveModelGeometries, 0, `${id}: model resources remain after unload`);
    assert.deepEqual(errors, []);
    const report = {
      format: 'molen/bridge-terrain-fit-review@1',
      candidateId: id,
      status: 'awaiting-human-image-review',
      sourceHash,
      runtimeHash,
      specHash: evidence.specHash,
      terrainEvidenceHash: hash(evidenceBytes),
      fixtureHash,
      ...(reviewRoads
        ? { roadEvidenceHash: hash(await readFile(resolve(output, `${id}-road-profile.json`))) }
        : {}),
      placementHash: hash(JSON.stringify(state.placement)),
      state,
      probes,
      frames,
      eviction,
      notes: [
        'Terrain is unmodified original source elevation. Surface gaps are observations; this report does not approve geographical fit.',
        'Ray probes use the authored centerline, including the mapped Mes bridge bend. Null model hits are preserved rather than extrapolated.',
        ...(evidence.reviewProbeBasis ? [evidence.reviewProbeBasis] : []),
      ],
    };
    await writeFile(
      resolve(output, `${id}${suffix}-fit-report.json`),
      `${JSON.stringify(report, null, 2)}\n`,
    );
    console.log(
      `${id}: ${frames.length} frames, endpoint gaps ${probes[0].clearance?.toFixed(2)} / ${probes.at(-1).clearance?.toFixed(2)} m, unload passed`,
    );
  }
} finally {
  await browser?.close();
  await server.close();
}
