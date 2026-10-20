/** Four actual mesh levels: mapped forecourt, real basin floor, bridges and nine court voids. */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';
import { parliamentHouse } from '../../../../../../../packages/worldgen/scripts/structure-parliament-house-canberra.mjs';

const dir = new URL('.', import.meta.url),
  root = new URL('../../../../../../../', dir),
  runtime = new URL('content/worldgen/assets/places/r3/r3d/parliament_house_canberra/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  frame = read('map-frame.json'),
  plan = read('forecourt-frame.json'),
  original = read('map-sources/forecourt-original.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three'),
  earcut = (await import(req.resolve('earcut'))).default,
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js')),
  failures = [],
  results = [];
assert.equal(
  hashBytes(fs.readFileSync(new URL('map-sources/forecourt-original.pbf', dir))),
  plan.source.tileHash,
);
const local = ([lon, lat]) => {
  const east = (lon - frame.anchor[0]) * 111320 * Math.cos((frame.anchor[1] * Math.PI) / 180),
    south = -(lat - frame.anchor[1]) * 111320,
    h = frame.heading;
  return [east * Math.cos(h) - south * Math.sin(h), east * Math.sin(h) + south * Math.cos(h)].map(
    (v) => +v.toFixed(5),
  );
};
const sourcePolys = (id) => {
  const f = original.features.find((f) => f.id === id);
  return (
    f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [f.geometry.coordinates]
  ).map((p) => p.map((r) => r.slice(0, -1).map(local)));
};
assert.deepEqual(plan.water, sourcePolys(23375713));
assert.deepEqual(plan.brownPaving, sourcePolys(35184580778912));
assert.deepEqual(plan.paleBorder, sourcePolys(52776560939335));
assert.deepEqual(plan.grass, [35184883299648, 35184883299649, 35184883299650].flatMap(sourcePolys));
function interiorPoint(poly) {
  const points = poly.flat(),
    holes = [];
  let count = poly[0].length;
  for (const r of poly.slice(1)) {
    holes.push(count);
    count += r.length;
  }
  const indices = earcut(points.flat(), holes),
    triangles = [];
  for (let i = 0; i < indices.length; i += 3) {
    const p = indices.slice(i, i + 3).map((j) => points[j]),
      area = Math.abs(
        (p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[2][0] - p[0][0]) * (p[1][1] - p[0][1]),
      );
    triangles.push({ area, point: [0, 1].map((k) => p.reduce((sum, v) => sum + v[k], 0) / 3) });
  }
  return triangles.sort((a, b) => b.area - a.area)[0].point;
}
function inside(p, r) {
  let yes = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++)
    if (
      r[i][1] > p[1] !== r[j][1] > p[1] &&
      p[0] < ((r[j][0] - r[i][0]) * (p[1] - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]
    )
      yes = !yes;
  return yes;
}
assert(inside(plan.dryReference.local, plan.brownPaving[0][0]));
assert(!plan.water.some((p) => inside(plan.dryReference.local, p[0])));
const openingProbes = [];
for (let x = -31; x <= 18; x += 1.5)
  for (let z = 138; z <= 199; z += 1.5)
    if (inside([x, z], plan.basinOutline)) openingProbes.push([x, z]);
assert(openingProbes.length > 700);
for (let d = 0; d < 4; d++) {
  const builder = new MeshBufferBuilder();
  parliamentHouse(builder, frame, d);
  const raw = builder.finalize();
  validateAuthoredMesh(raw, `Parliament source${d}`);
  assert(raw.triangleCount <= [1000, 4000, 16000, 64000][d]);
  const level = side.runtimeLods.levels[d],
    bytes = fs.readFileSync(new URL(level.file, runtime));
  assert.equal(hashBytes(bytes), level.hash);
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  gltf.scene.updateMatrixWorld(true);
  let triangles = 0;
  gltf.scene.traverse((object) => {
    if (object.material)
      for (const m of Array.isArray(object.material) ? object.material : [object.material])
        m.side = T.FrontSide;
    if (!object.geometry) return;
    const p = object.geometry.getAttribute('position'),
      n = object.geometry.getAttribute('normal'),
      uv = object.geometry.getAttribute('uv'),
      indices = object.geometry.index?.array ?? Uint32Array.from({ length: p.count }, (_, i) => i);
    validateAuthoredMesh(
      { positions: p.array, normals: n.array, uvs: uv.array, indices, vertexCount: p.count },
      `Parliament runtime${d}`,
    );
    triangles += indices.length / 3;
  });
  assert.equal(triangles, level.triangles);
  assert(level.drawCalls <= 6);
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
    },
    top = (x, z) => ray([x, 1, z], [x, -1.3, z])[0]?.point.y;
  for (const index of [22, 41, 93])
    for (const ring of frame.features.find((f) => f.index === index).rings.slice(1)) {
      const p = interiorPoint([ring]);
      check(
        'office/executive courtyard open',
        ray([p[0], 110, p[1]], [p[0], -19, p[1]]).length === 0,
        { index, point: p },
      );
    }
  for (const poly of plan.water) {
    const p = interiorPoint(poly),
      y = top(...p);
    check(
      'three separate mapped water patches',
      Math.abs(y - plan.verticalControls.waterTop) < 0.02,
      { point: p, y },
    );
  }
  for (const [x, z] of [
    [-24, 160],
    [13, 160],
    [-6.5, 141],
  ]) {
    const y = top(x, z);
    check('three real bridge approaches', Math.abs(y - plan.verticalControls.pavingTop) < 0.025, {
      x,
      z,
      y,
    });
  }
  for (const poly of plan.grass) {
    const p = interiorPoint(poly),
      y = top(...p);
    check('three raised planted beds', Math.abs(y - plan.verticalControls.plantingTop) < 0.025, {
      point: p,
      y,
    });
  }
  const mosaic = top(...plan.mosaic.center);
  check('square island mosaic plaza', Math.abs(mosaic - plan.verticalControls.mosaicTop) < 0.025, {
    y: mosaic,
  });
  const tip = ray([-8, 103, -12.5], [-8, 100, -12.5])[0];
  check('mast top at101m architectural estimate', !!tip && Math.abs(tip.point.y - 101) < 0.02, {
    y: tip?.point.y,
  });
  for (const [x, z] of openingProbes) {
    const y = top(x, z);
    check(
      'declared basin opening covered by actual authored floor or surface',
      Number.isFinite(y) && y >= -1.001,
      { x, z, y },
    );
  }
  results.push({
    level: level.name,
    triangles,
    drawCalls: level.drawCalls,
    hash: level.hash,
    controls: controls.length,
    failed: controls.filter((c) => !c.pass),
  });
}
const report = {
  status: failures.length ? 'failed' : 'passed',
  sourceHash: side.sourceHash,
  runtimeHash: side.hash,
  results,
  failures,
  basinOpeningCoverageProbes: openingProbes.length,
  mappedWaterPatches: 3,
  mappedGrassBeds: 3,
  courtAirControlsPerLevel: 9,
  sourceHeightsChanged: false,
  geographicAcceptance: false,
  scope:
    'Actual source/runtime meshes,forecourt source-plan identity,basin/bridges/planting/floor air and detail budgets. Ground fit is a separate held review.',
};
console.log(JSON.stringify(report, null, 2));
assert.equal(failures.length, 0, 'Parliament geometry controls failed');
