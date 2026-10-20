/** Inspect actual Float32 source/imported GLBs against native layout, exterior air routes and frozen ground. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';
import { taipeiConfuciusTemple } from '../../../../../../../packages/worldgen/scripts/structure-taipei-confucius-temple.mjs';

const root = new URL('../../../../../../../', import.meta.url),
  dir = new URL('.', import.meta.url),
  runtime = new URL('content/worldgen/assets/places/ws/wsq/taipei_confucius_temple/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  frame = read('map-frame.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js'));
assert.equal(
  hashBytes(fs.readFileSync(new URL('terrain-grid.json', dir))),
  'sha256:9eec89bb46587a4c4321d8c4ed14d02b2e43660738cae7e6d4914057a5d06f5c',
);
assert.equal(
  hashBytes(fs.readFileSync(new URL('terrain-review.height.png', dir))),
  'sha256:119ae21b4e054cc14a0023822d83474e370a10c907a5e98bf8f4d253041e0267',
);
const ground = read('terrain-grid.json'),
  rows = ground.heightsMeters,
  terrain = (x, z) => {
    const u = (x - ground.origin[0]) / ground.stepMeters,
      v = (z - ground.origin[1]) / ground.stepMeters,
      i = Math.floor(u),
      j = Math.floor(v),
      a = u - i,
      b = v - j;
    return (
      (rows[j][i] * (1 - a) + rows[j][i + 1] * a) * (1 - b) +
      (rows[j + 1][i] * (1 - a) + rows[j + 1][i + 1] * a) * b -
      ground.modelDatumElevationMeters
    );
  },
  limits = [1000, 4000, 16000, 64000],
  results = [],
  failures = [],
  heightSamples = [],
  contact = [];
const boxes = frame.geometry.parts.map((p) => ({
  p,
  x: (p.bounds.min[0] + p.bounds.max[0]) / 2,
  z: (p.bounds.min[1] + p.bounds.max[1]) / 2,
  w: p.bounds.max[0] - p.bounds.min[0],
  depth: p.bounds.max[1] - p.bounds.min[1],
}));
for (let d = 0; d < 4; d++) {
  const builder = new MeshBufferBuilder();
  taipeiConfuciusTemple(builder, frame, d);
  const source = builder.finalize();
  validateAuthoredMesh(source, `Temple source${d}`);
  assert(source.triangleCount <= limits[d]);
  const level = side.runtimeLods.levels[d],
    bytes = fs.readFileSync(new URL(level.file, runtime));
  assert.equal(hashBytes(bytes), level.hash);
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  gltf.scene.updateMatrixWorld(true);
  let triangles = 0;
  gltf.scene.traverse((o) => {
    if (o.material)
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.side = T.FrontSide;
    if (!o.geometry) return;
    const p = o.geometry.getAttribute('position'),
      n = o.geometry.getAttribute('normal'),
      uv = o.geometry.getAttribute('uv'),
      indices = o.geometry.index?.array ?? Uint32Array.from({ length: p.count }, (_, i) => i);
    validateAuthoredMesh(
      { positions: p.array, normals: n.array, uvs: uv.array, indices, vertexCount: p.count },
      `Temple runtime${d}`,
    );
    triangles += indices.length / 3;
  });
  assert.equal(triangles, level.triangles);
  assert(level.drawCalls <= 8);
  const controls = [],
    check = (name, pass, data = {}) => {
      controls.push({ name, pass, ...data });
      if (!pass) failures.push({ level: level.name, name, ...data });
    },
    ray = (a, b) => {
      const p = new T.Vector3(...a),
        v = new T.Vector3(...b).sub(p);
      return new T.Raycaster(
        p,
        v.clone().normalize(),
        0.00001,
        v.length() - 0.00001,
      ).intersectObject(gltf.scene);
    };
  // Fifteen independent native positions must have their own raised roofs, not only the ground/base.
  const samples = [];
  for (const { p, x, z, w, depth } of boxes)
    for (const a of [-0.4, 0, 0.4])
      for (const b of p.role === 'screen_wall' ? [0] : [-0.4, 0, 0.4]) {
        const xx = x + a * w,
          zz = z + b * depth,
          hits = ray([xx, 20, zz], [xx, 2.5, zz]);
        check('native component raised roof', hits.length > 0, {
          role: p.role,
          x: xx,
          z: zz,
          y: hits[0]?.point.y ?? null,
        });
        samples.push({ role: p.role, x: xx, z: zz, y: hits[0]?.point.y ?? null });
      }
  // Routes are measured in the imported asset, so backed windows cannot masquerade as passages.
  for (const [name, a, b] of [
    ['Yi central passage', [0, 2, 28], [0, 2, 42]],
    ['Lingxing east end passage', [13, 2, 50], [13, 2, 65]],
    ['Lingxing west end passage', [-11.5, 2, 50], [-11.5, 2, 65]],
    ['main front colonnade', [-7, 2.3, 8.4], [7, 2.3, 8.4]],
    ['west wing colonnade', [-15.1, 2, -17], [-15.1, 2, 27]],
    ['east wing colonnade', [14.15, 2, -17], [14.15, 2, 27]],
    ['main open court', [-12, 2, 22], [12, 2, 22]],
    ['rear open court', [-12, 2, -15], [12, 2, -15]],
    ['outer open court', [-10, 2, 46], [10, 2, 46]],
  ]) {
    const hits = ray(a, b);
    check(name, hits.length === 0, { a, b, first: hits[0]?.point.toArray() ?? null });
  }
  for (const { p, x, z } of boxes.filter((b) =>
    ['hong_gate', 'li_gate', 'yi_lu_gate', 'pan_gong_gate'].includes(b.p.role),
  )) {
    const hits = ray([x - 6, 1.5, z], [x + 6, 1.5, z]);
    check('outer arch remains open', hits.length === 0, {
      role: p.role,
      first: hits[0]?.point.toArray() ?? null,
    });
  }
  for (const dx of [-2.8, 0, 2.8]) {
    const x = frame.controls.panPondLocal[0] + dx,
      z = frame.controls.panPondLocal[1] - 3.5,
      hits = ray([x, 0.2, z - 2], [x, 0.2, z + 2]);
    check('Pan Bridge real arch', hits.length === 0, {
      x,
      z,
      first: hits[0]?.point.toArray() ?? null,
    });
  }
  for (const [x, z, floor] of [
    [0, 13, 0.85],
    [0, 8.3, 1.2],
    [-15.1, 10, 0.6],
    [14.15, 10, 0.6],
  ]) {
    const hits = ray([x, 2, z], [x, -1.1, z]);
    check(
      'own plinth floor retained',
      hits.length > 0 && Math.abs(hits[0].point.y - floor) < 0.001,
      { x, z, floor, y: hits[0]?.point.y ?? null },
    );
  }
  // The roof is tested above its own undercroft; all three main doubles must remain continuous.
  for (const role of ['dacheng_hall', 'yi_gate', 'lingxing_gate']) {
    const { x, z, w, depth } = boxes.find((b) => b.p.role === role);
    for (const a of [-0.3, -0.15, 0, 0.15, 0.3])
      for (const b of [-0.3, 0, 0.3]) {
        const xx = x + a * w,
          zz = z + b * depth,
          hits = ray([xx, 20, zz], [xx, 5.5, zz]);
        check('double roof continuity', hits.length > 0, {
          role,
          x: xx,
          z: zz,
          y: hits[0]?.point.y ?? null,
        });
        samples.push({ role, x: xx, z: zz, y: hits[0]?.point.y ?? null });
      }
  }
  heightSamples.push(samples);
  results.push({
    level: level.name,
    triangles,
    drawCalls: level.drawCalls,
    hash: level.hash,
    controls: controls.length,
    failed: controls.filter((c) => !c.pass),
    checks: controls,
  });
}
for (const { p, w, depth, x, z } of boxes) {
  if (p.role === 'screen_wall') continue;
  const floor =
    p.role === 'dacheng_hall'
      ? 1.2
      : ['hong_gate', 'li_gate', 'yi_lu_gate', 'pan_gong_gate'].includes(p.role)
        ? 0.15
        : 0.6;
  for (let side = 0; side < 4; side++)
    for (let i = 0; i <= 16; i++) {
      const u = -0.48 + (0.96 * i) / 16,
        xx = side < 2 ? x + (side === 0 ? -0.48 : 0.48) * w : x + u * w,
        zz = side < 2 ? z + u * depth : z + (side === 2 ? -0.48 : 0.48) * depth,
        h = terrain(xx, zz);
      const pass = h > -1 && h < floor;
      contact.push({ role: p.role, x: xx, z: zz, ground: h, floor, pass });
      if (!pass)
        failures.push({
          name: 'source ground contact',
          role: p.role,
          x: xx,
          z: zz,
          ground: h,
          floor,
        });
    }
}
const lodDifferences = heightSamples.slice(0, 3).map((r, d) => {
  const differences = r.map((p, i) =>
      p.y !== null && heightSamples[3][i].y !== null ? Math.abs(p.y - heightSamples[3][i].y) : 0,
    ),
    maximum = Math.max(...differences),
    budget = side.runtimeLods.levels[d].errorMeters;
  assert(maximum <= budget + 0.001, `${d} sampled roof difference ${maximum}>${budget}`);
  return {
    level: side.runtimeLods.levels[d].name,
    sampledMaximumRoofHeightDifference: maximum,
    budget,
  };
});
const report = {
  format: 'molen/structure-geometry-review@1',
  status: failures.length ? 'failed' : 'passed',
  asset: side.id,
  sourceHash: side.sourceHash,
  runtimeHash: side.hash,
  results,
  lodDifferences,
  terrainContact: {
    probes: contact.length,
    relativeGroundRange: [
      Math.min(...contact.map((p) => p.ground)),
      Math.max(...contact.map((p) => p.ground)),
    ],
    ownFoundationBaseMeters: -1,
    perComponentFloors: { dacheng: 1.2, otherHalls: 0.6, outerGates: 0.15 },
    sourceGroundUnchanged: true,
    failures: contact.filter((p) => !p.pass),
  },
  failures,
  scope:
    'Native fifteen-part layout and exterior roof/plinth/air controls in every actual imported LOD. Frozen source grid reproduced independently. Approximate exterior only, not surveyed ornament, whole terrain compatibility or navigable interior.',
};
const out = process.argv.find((a) => a.startsWith('--out='))?.slice(6);
if (out) fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
console.log({
  levels: results.map((r) => ({
    level: r.level,
    triangles: r.triangles,
    controls: r.controls,
    failed: r.failed.length,
  })),
  lodDifferences,
  ground: report.terrainContact,
  failures,
});
assert.equal(failures.length, 0);
