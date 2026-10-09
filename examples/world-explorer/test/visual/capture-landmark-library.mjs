/** node examples/world-explorer/test/visual/capture-landmark-library.mjs --ids=N0637,N0641 */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import {
  hashEvidenceText,
  matchesEvidenceText,
} from '../../../../packages/worldgen/scripts/evidence-text-hash.mjs';
import {
  authoredModels,
  content,
  hashBytes,
  readOptionalJson,
  registerSourceDocuments,
  root,
} from '../../../../packages/worldgen/scripts/structure-model-files.mjs';
import {
  createStructureIndex,
  isStructureViewingDate,
} from '../../../../packages/worldgen-earth/dist/kernel.mjs';
import { featureLines } from '../../../../packages/worldgen-earth/scripts/structure-map-geometry.mjs';
import { sourceLocalFootprint } from './landmark-capture-footprint.mjs';
import { landmarkSceneTriangles } from './landmark-capture-geometry.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(resolve(root, 'packages/tooling/package.json'));
const { chromium } = require('playwright');
const outputIndex = process.argv.indexOf('--out-dir');
const outputDirectory = outputIndex >= 0 ? process.argv[outputIndex + 1] : undefined;
const viewingDate = process.argv
  .find((arg) => arg.startsWith('--viewing-date='))
  ?.slice('--viewing-date='.length);
if (viewingDate !== undefined && !isStructureViewingDate(viewingDate))
  throw new Error('--viewing-date needs a valid YYYY-MM-DD calendar date');
if (outputIndex >= 0 && !outputDirectory) throw new Error('--out-dir needs a directory');
const placements = await readOptionalJson(
  resolve(root, 'content/earth/structures/placements.json'),
);
const geography = await readOptionalJson(
  resolve(root, 'content/earth/structures/georeferencing.json'),
);
const structureIndex = createStructureIndex(placements);
const queryOptions = viewingDate === undefined ? false : { viewingDate };
const evidence = await readOptionalJson(
  resolve(root, 'content/earth/structures/evidence/osm-features.json'),
);
const pack = await readOptionalJson(resolve(content, 'stylepack.json'));
const fixtureBytes = Buffer.concat(
  await Promise.all(
    ['landmark-library.ts', 'landmark-library.html', 'landmark-capture-clipping.mjs'].map((name) =>
      readFile(resolve(here, name)),
    ),
  ),
);
const fixtureHash = hashEvidenceText(fixtureBytes);
// The previous fixture excluded sea-level entries. Its terrain-only path, lighting and
// cameras are unchanged, so those existing image-hash-bound reviews remain reproducible.
const terrainOnlyFixtureHash =
  'sha256:5e50bd0a6aed4485b81606c836567c2c09c8642a6d466d548d2f2f24516ad17b';
const unreflectedFixtureHash =
  'sha256:7a7f203867111f5939adde34be84be27bd20a4340f1710d830bef77bb75e784d';
// Same default light rig before the opt-in imports were formatted by Biome.
const optInUnformattedFixtureHash =
  'sha256:41fc5327bd6ea19c76e999b32a703a2116ca856dea92070783467eb20de0a453';
// Only neighbor visibility and telemetry changed. Existing isolated images keep their
// original render path when every recorded load was the target asset.
const singleLandmarkFixtureHash =
  'sha256:3dc3824114fb46029b6a424af8098d75a98b8b5bd306db741d028163415abde5';
// Ground opening telemetry and assertions do not change images without a cutout.
const unchangedGroundFixtureHashes = new Set([
  'sha256:b6da2ddf244fb0c1e9d19364965dad14cb80ed0d56bb87cb7ac46db8ca150568',
  'sha256:30a01c038a2fc391e1d7ec2c992fc210adc9fcf8831e2d419cf8aa0531f1e6cf',
]);
// Open centerlines add a separate LineSegments path; existing polygon reviews still use Line.
const polygonOnlyFixtureHash =
  'sha256:89963376bdbdbaaaa998a456de621835fe473bf28f5ef1a08c3927496e7d9a61';
// Explicit dated placement adds no changes to the undated rendering path.
const undatedFixtureHash =
  'sha256:36e8975a19939e4721614f21f41c2e7865a16cadc727ced17c51433c6e5fb126';
// The opt-in depth precision path leaves legacy captures unchanged.
const legacyClippingFixtureHash =
  'sha256:5ca7b41b8ec6372a507ffc2bc8aec323e810596f3b37867aec0e64c576383cd5';
// Only asset URL resolution changed; model bytes, cameras and rendering are unchanged.
const conventionAssetFixtureHash =
  'sha256:be058e28bfed8e1aca0503d33060226a079b1d252f0b99ea231ce2d93d7f044b';
// The bank-reference sampler changes only geographic entries with terrainReference.
// Other entries and bounded asset-review captures retain their prior rendering path.
const originContactFixtureHash =
  'sha256:3ba443c97b22b2dabe622d790b27f37a66b57d841e80d2d30b8e370657d18042';
// An opt-in source label changes only the placement caption for non-OSM reference data.
const osmCaptionFixtureHash =
  'sha256:1fdd7e5e99dbdd7f25f2c656a2f6d782fada208969740897011b66b32f5ffe44';
// An explicit isolated-stage datum preserves the default rendering path for all other assets.
const zeroReviewDatumFixtureHash =
  'sha256:e5ff1076d5144e8414aa682b08e5f97a67a4c5fc8ecd23613bf7b5c4b20eae36';
const clippingMode = process.argv.includes('--adaptive-clipping') ? 'bounds' : 'legacy';
const reflectionMode = process.argv.includes('--reflections') ? 'sky-pmrem' : 'none';
const selected = await authoredModels();
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
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(
    `http://127.0.0.1:${server.httpServer.address().port}/landmark-library.html?reflections=${reflectionMode === 'sky-pmrem' ? 1 : 0}&clipping=${clippingMode === 'bounds' ? 'adaptive' : 'legacy'}`,
    {
      waitUntil: 'networkidle',
    },
  );
  await page
    .waitForFunction(() => !!window.landmarkLibraryQA, undefined, { timeout: 120000 })
    .catch((cause) => {
      throw new Error(
        `Landmark fixture did not initialize. Browser errors: ${errors.join('; ') || 'none reported'}`,
        { cause },
      );
    });
  for (const { dir, spec, sourceHash, inputHash } of selected) {
    const output = outputDirectory ? resolve(outputDirectory, spec.id) : dir;
    const sidecarPath = pack.assets[spec.assetId];
    assert(sidecarPath, `${spec.id}: runtime asset is not registered`);
    const sidecar = await readOptionalJson(resolve(content, sidecarPath));
    assert.equal(sidecar?.sourceHash, sourceHash, `${spec.id}: import the current source first`);
    const runtimeBytes = await readFile(resolve(content, dirname(sidecarPath), sidecar.files.main));
    assert.equal(hashBytes(runtimeBytes), sidecar.hash);
    const placement = structureIndex
      .query([-180, -90, 180, 90], queryOptions)
      .find((entry) => entry.asset === spec.assetId);
    const placementHash = placement ? hashBytes(JSON.stringify(placement)) : null;
    const sourceFrameBytes =
      spec.geographicProposal?.mapGeometrySource === 'map-frame.json'
        ? await readFile(resolve(dir, 'map-frame.json'))
        : undefined;
    const localFootprint = sourceLocalFootprint(spec, sourceFrameBytes);
    const prior = await readOptionalJson(resolve(output, 'shared-capture-report.json'));
    const reviewGroundY =
      spec.mediumFiContext?.groundY === undefined
        ? undefined
        : Number(spec.mediumFiContext.groundY);
    assert(
      reviewGroundY === undefined || Number.isFinite(reviewGroundY),
      'Invalid review ground datum',
    );
    let current =
      (prior?.footprintLabel ?? null) === (localFootprint?.label ?? null) &&
      (!localFootprint || matchesEvidenceText(sourceFrameBytes, prior?.footprintEvidenceHash)) &&
      prior?.inputHash === inputHash &&
      prior?.sourceHash === sourceHash &&
      prior?.runtimeHash === sidecar.hash &&
      (prior?.reviewGroundY ?? null) === (reviewGroundY ?? null) &&
      (prior?.viewingDate ?? null) === (viewingDate ?? null) &&
      (prior?.reflectionMode ?? 'none') === reflectionMode &&
      (prior?.clippingMode ?? 'legacy') === clippingMode &&
      (!placement?.terrainReference ||
        placement.bounds ||
        prior?.frames?.some((frame) =>
          frame.state?.terrainSamples?.some((sample) => sample.placementId === placement.id),
        )) &&
      (matchesEvidenceText(fixtureBytes, prior?.fixtureHash) ||
        (prior?.fixtureHash === zeroReviewDatumFixtureHash && reviewGroundY === undefined) ||
        prior?.fixtureHash === osmCaptionFixtureHash ||
        prior?.fixtureHash === originContactFixtureHash ||
        prior?.fixtureHash === conventionAssetFixtureHash ||
        (prior?.fixtureHash === legacyClippingFixtureHash && clippingMode === 'legacy') ||
        (prior?.fixtureHash === undatedFixtureHash && viewingDate === undefined) ||
        (prior?.fixtureHash === polygonOnlyFixtureHash && !localFootprint?.lines) ||
        (!placement?.groundCutout && unchangedGroundFixtureHashes.has(prior?.fixtureHash)) ||
        (prior?.fixtureHash === singleLandmarkFixtureHash &&
          prior.frames?.every((frame) =>
            frame.state?.loads?.every((asset) => asset === spec.assetId),
          )) ||
        (prior?.fixtureHash === unreflectedFixtureHash && reflectionMode === 'none') ||
        (prior?.fixtureHash === optInUnformattedFixtureHash && reflectionMode === 'none') ||
        (prior?.fixtureHash === terrainOnlyFixtureHash && placement?.datum !== 'sea-level')) &&
      prior?.placementHash === placementHash &&
      prior?.frames?.length > 0 &&
      (!placement?.groundCutout ||
        (prior?.eviction?.groundRestored === true &&
          prior?.groundLifecycle?.visibleOpen === true &&
          prior.frames.every(
            (frame) =>
              frame.state?.groundCutoutActive === true &&
              frame.state?.groundCoversCutoutProbe === false,
          )));
    if (current) {
      for (const [path, expected, text] of [
        ...prior.frames.map((frame) => [resolve(output, frame.path), frame.hash, false]),
        ...Object.values(prior.materialGraphs).map((graph) => [
          resolve(content, graph.path),
          graph.hash,
          true,
        ]),
      ]) {
        try {
          const bytes = await readFile(path);
          if (text ? !matchesEvidenceText(bytes, expected) : hashBytes(bytes) !== expected)
            current = false;
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
          current = false;
        }
      }
    }
    if (process.argv.includes('--check')) {
      assert(current, `${spec.id}: stale or missing shared-surface captures`);
      console.log(`${spec.id}: shared captures current`);
      continue;
    }
    if (current && !process.argv.includes('--force')) {
      console.log(`${spec.id}: current shared captures retained`);
      continue;
    }
    const geo = geography.candidates.find((entry) => entry.candidateId === spec.id);
    const feature = (evidence.elements ?? evidence.features ?? []).find((entry) =>
      (geo?.featureIds ?? []).includes(`${entry.type}/${entry.id}`),
    );
    const footprint =
      localFootprint?.footprint ??
      (feature
        ? featureLines(feature).find((line) => line.role === 'outer')?.coordinates
        : undefined);
    const mounted = await page.evaluate((input) => window.landmarkLibraryQA.mount(input), {
      asset: spec.assetId,
      title: spec.title,
      reviewGroundY,
      placement,
      footprint,
      footprintLabel: localFootprint?.label,
      footprintLines: localFootprint?.lines,
      viewingDate,
    });
    const runtimeGltf = JSON.parse(
      runtimeBytes.subarray(20, 20 + runtimeBytes.readUInt32LE(12)).toString('utf8'),
    );
    assert.equal(
      mounted.triangles,
      landmarkSceneTriangles(runtimeGltf, { expandGpuInstances: false }),
      'The original detailed geometry must reach the viewer',
    );
    assert(mounted.loads.includes(spec.assetId), 'The requested landmark must be loaded');
    assert.equal(new Set(mounted.loads).size, mounted.loads.length, 'Each model loads only once');
    if (mounted.mode === 'geographic-flat-terrain') {
      const [west, south, east, north] = mounted.selectionBounds;
      assert(west < east && south < north && east - west < 0.02 && north - south < 0.02);
      const localAssets = new Set(
        structureIndex
          .query([west, south, east, north], queryOptions)
          .filter((entry) => {
            if ((entry.minLevel ?? 11) > 16) return false;
            const b = entry.bounds;
            if (b) return b[2] >= west && b[0] <= east && b[3] >= south && b[1] <= north;
            return (
              entry.anchor[0] >= west &&
              entry.anchor[0] < east &&
              entry.anchor[1] > south &&
              entry.anchor[1] <= north
            );
          })
          .map((entry) => entry.asset),
      );
      assert(
        mounted.loads.every((asset) => localAssets.has(asset)),
        'No remote landmark may load',
      );
      assert.deepEqual(
        mounted.visibleStructures,
        [placement.id],
        'Only the review target is visible',
      );
    } else {
      assert.deepEqual(mounted.loads, [spec.assetId]);
      assert.equal(mounted.reviewGroundY, reviewGroundY ?? 0);
    }
    for (const surface of spec.sharedSurfaces ?? []) {
      assert(mounted.surfaces[`worldgen:${surface.ref}`], `Missing shared texture: ${surface.ref}`);
    }
    if (placement && mounted.mode === 'geographic-flat-terrain') {
      assert.equal(mounted.placementId, placement.id);
      assert(Math.abs(mounted.heading - (placement.heading ?? 0)) < 1e-7);
      assert(
        Math.abs(mounted.position[0]) < 1e-6 && Math.abs(mounted.position[2]) < 1e-6,
        'Geographic anchor must be the model origin',
      );
      assert(Math.abs(mounted.position[1] - (placement.elevation ?? 0)) < 1e-6);
      if (placement.terrainReference) {
        const samples = mounted.terrainSamples.filter(
          (sample) => sample.placementId === placement.id,
        );
        assert(samples.length > 0, 'The viewer must sample the separate bank reference');
        for (const sample of samples) {
          assert.deepEqual(sample.coordinate, placement.terrainReference.anchor);
          assert.equal(
            sample.height,
            placement.terrainReference.modelHeight * (placement.scale?.[1] ?? 1),
          );
        }
      }
    }
    const materialGraphs = {};
    for (const surface of Object.keys(mounted.surfaces)) {
      const ref = surface.slice('worldgen:'.length);
      const path = pack.materials[ref.replace(/^matgraph:/, '')];
      materialGraphs[ref] = {
        path,
        hash: hashEvidenceText(await readFile(resolve(content, path))),
      };
    }
    const cameras = Array.isArray(spec.qaCameras)
      ? spec.qaCameras
      : Object.entries(spec.qaCameras ?? {}).map(([name, camera]) => ({ name, ...camera }));
    const views = [
      ...[0.6, 0.6 + Math.PI / 2, 0.6 + Math.PI, 0.6 + (3 * Math.PI) / 2].map((angle, i) => ({
        name: `angle-${i}`,
        angle,
      })),
      ...cameras,
      ...(mounted.mode === 'geographic-flat-terrain'
        ? [{ name: 'placement', placement: true }]
        : []),
    ];
    await mkdir(resolve(output, 'shots/shared'), { recursive: true });
    const frames = [];
    for (const view of views) {
      assert(/^[a-z0-9_-]+$/.test(view.name), `Invalid camera name: ${view.name}`);
      const state = await page.evaluate((input) => window.landmarkLibraryQA.view(input), view);
      assert(state.draws > 0 && state.renderedTriangles > 0);
      if (
        view.name === 'angle-0' &&
        runtimeGltf.extensionsUsed?.includes('EXT_mesh_gpu_instancing')
      ) {
        assert(
          state.renderedTriangles >= landmarkSceneTriangles(runtimeGltf),
          'Every GPU instance must reach an actual draw in the full-asset view',
        );
      }
      assert.equal(
        state.groundCutoutActive,
        !!placement?.groundCutout,
        'Only a placed ground opening may change ground geometry',
      );
      if (placement?.groundCutout)
        assert.equal(
          state.groundCoversCutoutProbe,
          false,
          'Ground must not cover the sunken structure',
        );
      assert(
        Object.values(state.surfaceReads).every((count) => count === 1),
        'The shared library should bake each graph once across all models',
      );
      const path = resolve(output, `shots/shared/${view.name}.png`);
      await page.screenshot({ path });
      frames.push({
        path: relative(output, path).replaceAll('\\', '/'),
        hash: hashBytes(await readFile(path)),
        camera: view,
        state,
      });
    }
    const groundLifecycle = await page.evaluate(() =>
      window.landmarkLibraryQA.verifyGroundLifecycle(),
    );
    if (placement?.groundCutout)
      assert(
        groundLifecycle.hiddenRestored && groundLifecycle.visibleOpen,
        'Hiding the structure restores ground and showing it reopens the polygon',
      );
    else assert(groundLifecycle.unchanged, 'Ordinary models retain original ground geometry');
    const eviction = await page.evaluate(() => window.landmarkLibraryQA.unload());
    assert(
      eviction.disposed && eviction.liveModelGeometries === 0,
      'Tile unload must release every landmark geometry',
    );
    assert(
      eviction.groundRestored,
      'Tile unload restores original ground geometry and ray intersection',
    );
    assert.deepEqual(errors, []);
    const report = {
      format: 'molen/structure-shared-capture@1',
      assetId: spec.assetId,
      inputHash,
      sourceHash,
      runtimeHash: sidecar.hash,
      reviewGroundY: reviewGroundY ?? null,
      fixtureHash,
      ...(viewingDate !== undefined ? { viewingDate } : {}),
      ...(localFootprint ? { footprintEvidenceHash: localFootprint.hash } : {}),
      ...(localFootprint?.label ? { footprintLabel: localFootprint.label } : {}),
      reflectionMode,
      clippingMode,
      placementHash,
      materialGraphs,
      frames,
      eviction,
      groundLifecycle,
      errors,
      scope:
        'Actual viewer model/material loading and geographic placement on flat test terrain. This checks rendering and transforms, not terrain-data accuracy or maximum fidelity.',
    };
    await writeFile(
      resolve(output, 'shared-capture-report.json'),
      `${JSON.stringify(report, null, 2)}\n`,
    );
    if (!outputDirectory) await registerSourceDocuments(dir, ['shared-capture-report.json']);
    console.log(
      `${spec.id}: ${frames.length} shared-surface views; ${mounted.mode}; unload passed`,
    );
  }
} finally {
  await browser?.close();
  await server.close();
}
