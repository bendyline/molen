/** Read-only checks of the actual imported fort meshes and unchanged external elevation evidence. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { elMorro } from '../../../../../../../packages/worldgen/scripts/structure-el-morro.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';

const root = new URL('../../../../../../../', import.meta.url);
process.chdir(root.pathname);
const dir = new URL('.', import.meta.url),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir)));
const req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three');
const { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js'));
const layout = read('fort-layout.json'),
  registration = read('plan-registration.json'),
  terrain = read('terrain-grid.json');
const runtime = new URL('content/worldgen/assets/places/de/de2/el_morro/', root);
const side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  checks = [],
  failures = [],
  meshChecks = [];
const world = ([u, v], y) => {
  const m = registration.matrixSourcePixelsToLocalXZ,
    t = registration.translationLocalXZ;
  return [m[0][0] * u + m[0][1] * v + t[0], y, m[1][0] * u + m[1][1] * v + t[1]];
};
const record = (level, name, pass, data = {}) => {
  const r = { level, name, ...data };
  checks.push(r);
  if (!pass) failures.push(r);
};
for (let d = 0; d < 4; d++) {
  const source = new MeshBufferBuilder();
  elMorro(source, undefined, d);
  const m = source.finalize();
  validateAuthoredMesh(m, `fort-source-${d}`);
  assert(m.triangleCount <= [1000, 4000, 16000, 64000][d]);
  const level = side.runtimeLods.levels[d],
    bytes = fs.readFileSync(new URL(level.file, runtime));
  assert.equal(hashBytes(bytes), level.hash);
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  gltf.scene.updateMatrixWorld(true);
  const vertices = [];
  let actualTriangles = 0;
  gltf.scene.traverse((o) => {
    if (o.material)
      for (const material of Array.isArray(o.material) ? o.material : [o.material])
        material.side = T.DoubleSide;
    if (!o.geometry) return;
    const p = o.geometry.getAttribute('position'),
      n = o.geometry.getAttribute('normal'),
      uv = o.geometry.getAttribute('uv');
    const indices = o.geometry.index?.array ?? Uint32Array.from({ length: p.count }, (_, i) => i);
    validateAuthoredMesh(
      { positions: p.array, normals: n.array, uvs: uv.array, indices, vertexCount: p.count },
      `fort-runtime-${d}`,
    );
    actualTriangles += indices.length / 3;
    for (let i = 0; i < p.count; i++) vertices.push([p.getX(i), p.getY(i), p.getZ(i)]);
  });
  assert.equal(actualTriangles, level.triangles);
  meshChecks.push({
    level: level.name,
    authoredTriangles: m.triangleCount,
    runtimeTriangles: actualTriangles,
    drawCalls: level.drawCalls,
    hash: level.hash,
  });
  const ray = (a, b) => {
    const p = new T.Vector3(...a),
      v = new T.Vector3(...b).sub(p);
    return new T.Raycaster(p, v.clone().normalize(), 0.00001, v.length() - 0.00001).intersectObject(
      gltf.scene,
    );
  };
  for (const [key, y] of [
    ['lowOuter', layout.levels.lowerCourt],
    ['waterBattery', layout.levels.waterBattery],
    ['northBastion', layout.levels.upper],
    ['southBastion', layout.levels.upper],
  ]) {
    let error = 0;
    for (const p of layout[key]) {
      const q = world(p, y);
      error = Math.max(
        error,
        vertices.reduce((a, v) => Math.min(a, Math.hypot(...v.map((x, k) => x - q[k]))), Infinity),
      );
    }
    record(d, 'registered measured component wall-top trace', error < 0.0001, {
      component: key,
      maximumFloat32ErrorMeters: error,
    });
  }
  for (const dv of [-8, 0, 8])
    for (const y of [layout.levels.parade + 1.1, layout.levels.parade + 2.1]) {
      const hit = ray(world([1780, 1045 + dv], y), world([2090, 1045 + dv], y));
      record(d, 'main sallyport connects parade to bridge', hit.length === 0, {
        planV: 1045 + dv,
        y,
        first: hit[0]?.point.toArray() ?? null,
      });
    }
  for (let j = 0; j < 6; j++)
    for (const delta of [0.8, 1.6]) {
      const u = 2048 + ((j + 0.5) * (2395 - 2048)) / 6,
        y = layout.levels.moat + delta;
      const hit = ray(world([u, 1000], y), world([u, 1090], y));
      record(d, 'one of six bridge arches has an actual open negative volume', hit.length === 0, {
        arch: j + 1,
        y,
        first: hit[0]?.point.toArray() ?? null,
      });
    }
  for (const v of [800, 900, 1020, 1150, 1250])
    for (const u of [1800, 1830]) {
      const a = world([u, v], layout.levels.parade + 0.4),
        b = world([u, v], layout.levels.parade - 0.05),
        floorHit = ray(a, b);
      record(
        d,
        'actual parade floor at measured relative level',
        floorHit.length > 0 && Math.abs(floorHit[0].point.y - layout.levels.parade) < 0.0001,
        { u, v, y: floorHit[0]?.point.y },
      );
      const sky = ray(a, world([u, v], 45));
      record(d, 'parade remains open to sky', sky.length === 0, {
        u,
        v,
        first: sky[0]?.point.toArray() ?? null,
      });
    }
  const p = world([1280, 920], layout.levels.lowerCourt + 0.2),
    below = world([1280, 920], layout.levels.lowerCourt - 0.1);
  const lower = ray(p, below);
  record(
    d,
    'separate lower court floor exists',
    lower.length > 0 && Math.abs(lower[0].point.y - layout.levels.lowerCourt) < 0.0001,
  );
  const sky = ray(p, world([1280, 920], 45));
  record(d, 'lower court is open above its own floor', sky.length === 0, {
    first: sky[0]?.point.toArray() ?? null,
  });
}
const held = {
  grid: hashBytes(fs.readFileSync(new URL('terrain-grid.json', dir))),
  heightPng: hashBytes(fs.readFileSync(new URL('terrain-review.height.png', dir))),
};
assert.equal(held.grid, 'sha256:1ba52f53f18b500328adcee8a1538c7ff7b1366044185f5b1e2917daa48ecc47');
assert.equal(
  held.heightPng,
  'sha256:6e8ad6a4985ba4678a0bc71daa9ad85cfb6e9f3015d807bbec4290c8ad2cfcf8',
);
const sample = (p) => {
  const [x, , z] = world(p, 0),
    a = x - terrain.origin[0],
    b = z - terrain.origin[1],
    i = Math.floor(a),
    j = Math.floor(b),
    u = a - i,
    v = b - j,
    h = terrain.heightsMeters;
  return (
    (h[j][i] * (1 - u) + h[j][i + 1] * u) * (1 - v) +
    (h[j + 1][i] * (1 - u) + h[j + 1][i + 1] * u) * v -
    terrain.modelDatumElevationMeters
  );
};
const terrainConflicts = [];
for (const v of [825, 885, 945, 1045, 1105, 1165, 1230]) {
  const plan = [1880, v],
    provider = sample(plan);
  terrainConflicts.push({
    part: 'covered arcade porch',
    sourcePlanPixel: plan,
    providerRelativeHeight: provider,
    architecturalFloor: layout.levels.parade,
    terrainAboveFloor: provider - layout.levels.parade,
  });
}
for (let j = 0; j < 6; j++) {
  const plan = [2048 + ((j + 0.5) * 347) / 6, 1045],
    provider = sample(plan);
  terrainConflicts.push({
    part: 'bridge arch center',
    sourcePlanPixel: plan,
    providerRelativeHeight: provider,
    architecturalVoidProbe: layout.levels.moat + 1.2,
    terrainAboveProbe: provider - layout.levels.moat - 1.2,
  });
}
const report = {
  format: 'molen/structure-geometry-review@1',
  status: failures.length
    ? 'failed'
    : 'geometry-controls-passed; geographic-overlap-review-required',
  assetId: 'molen.worldgen.structure.el_morro',
  masterHash: side.hash,
  lodRecipeHash: side.runtimeLods.recipeHash,
  meshChecks,
  checks,
  failures,
  heldIndependentTerrain: held,
  terrainConflicts,
  limitations: [
    'These are actual imported-model geometry checks, not geographic approval.',
    'The original provider field retains covered fort surfaces/bridge. Ground conflict probes explicitly remain unresolved; no source values changed and no completion annotation is authorized by this report.',
    'Trace coordinates are registered historical component plans, not a claimed exact match to the low-zoom native map envelope.',
  ],
};
if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
else
  console.log(
    JSON.stringify(
      { status: report.status, checks: checks.length, failures, meshChecks, terrainConflicts },
      null,
      2,
    ),
  );
assert.equal(failures.length, 0, 'Actual runtime fort geometry controls failed');
