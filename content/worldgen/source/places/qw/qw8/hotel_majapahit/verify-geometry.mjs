/** Actual imported levels: supported polygonal footing and unfilled window/corbel reveals. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { majapahit } from '../../../../../../../packages/worldgen/scripts/structure-hotel-majapahit.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';

const dir = new URL('.', import.meta.url),
  root = new URL('../../../../../../../', dir),
  runtime = new URL('content/worldgen/assets/places/qw/qw8/hotel_majapahit/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  frame = read('map-frame.json'),
  grid = read('terrain-grid.json'),
  before = read('terrain-sources/before-deltadtm.json').snapshot,
  beforeRepair = read('terrain-sources/before-portico-repair.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js')),
  failures = [],
  results = [],
  allHeights = [];
for (const [file, expected] of [
  ['map-frame.json', beforeRepair.mapFrameHash],
  ['terrain-grid.json', beforeRepair.gridHash],
  ['terrain-review.terrain.json', beforeRepair.descriptorHash],
  ['terrain-review.height.png', beforeRepair.heightfieldHash],
])
  assert.equal(hashBytes(fs.readFileSync(new URL(file, dir))), expected);
assert.deepEqual(frame.anchor, before.anchor);
assert.equal(frame.heading, before.heading);
assert.deepEqual(frame.terrainContact, before.terrainContact);

function ground(x, z) {
  const u = (x - grid.origin[0]) / grid.stepMeters,
    v = (z - grid.origin[1]) / grid.stepMeters,
    i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    h = grid.heightsMeters;
  return (
    h[j][i] * (1 - a) * (1 - b) +
    h[j][i + 1] * a * (1 - b) +
    h[j + 1][i] * (1 - a) * b +
    h[j + 1][i + 1] * a * b -
    grid.modelDatumElevationMeters
  );
}
for (let d = 0; d < 4; d++) {
  const builder = new MeshBufferBuilder();
  majapahit(builder, frame, d);
  validateAuthoredMesh(builder.finalize(), `Hotel Majapahit source${d}`);
  const level = side.runtimeLods.levels[d],
    bytes = fs.readFileSync(new URL(level.file, runtime));
  assert.equal(hashBytes(bytes), level.hash);
  assert(level.triangles <= [1000, 4000, 16000, 64000][d]);
  assert(level.drawCalls <= 6);
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  gltf.scene.updateMatrixWorld(true);
  let triangles = 0;
  gltf.scene.traverse((object) => {
    if (object.material)
      for (const material of Array.isArray(object.material) ? object.material : [object.material])
        material.side = T.FrontSide;
    if (!object.geometry) return;
    const p = object.geometry.getAttribute('position'),
      n = object.geometry.getAttribute('normal'),
      uv = object.geometry.getAttribute('uv'),
      indices = object.geometry.index?.array ?? Uint32Array.from({ length: p.count }, (_, i) => i);
    validateAuthoredMesh(
      { positions: p.array, normals: n.array, uvs: uv.array, indices, vertexCount: p.count },
      `Hotel Majapahit runtime${d}`,
    );
    triangles += indices.length / 3;
  });
  assert.equal(triangles, level.triangles);
  const checks = [],
    check = (name, pass, data = {}) => {
      checks.push({ name, pass, ...data });
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
  const footHeights = [],
    segments = new Map();
  // Intersect actual low vertical wall faces with a fixed plane below local grade.
  // This samples physical model feet, including the skyline's simplified room cores.
  gltf.scene.traverse((object) => {
    if (!object.geometry) return;
    const p = object.geometry.getAttribute('position'),
      n = object.geometry.getAttribute('normal'),
      indices = object.geometry.index?.array ?? Uint32Array.from({ length: p.count }, (_, i) => i);
    for (let i = 0; i < indices.length; i += 3) {
      const ids = Array.from(indices.slice(i, i + 3));
      if (ids.some((j) => Math.abs(n.getY(j)) > 0.0001)) continue;
      const points = ids.map((j) =>
        new T.Vector3().fromBufferAttribute(p, j).applyMatrix4(object.matrixWorld),
      );
      const intersections = [];
      for (let j = 0; j < 3; j++) {
        const a = points[j],
          b = points[(j + 1) % 3];
        if (a.y < -0.9 !== b.y < -0.9) {
          const t = (-0.9 - a.y) / (b.y - a.y);
          intersections.push([a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t]);
        }
      }
      if (
        intersections.length !== 2 ||
        Math.hypot(
          intersections[0][0] - intersections[1][0],
          intersections[0][1] - intersections[1][1],
        ) < 0.002
      )
        continue;
      const key = intersections
        .map((p) => p.map((v) => v.toFixed(4)).join(','))
        .sort()
        .join(';');
      segments.set(key, intersections);
    }
  });
  for (const [start, end] of segments.values()) {
    const length = Math.hypot(end[0] - start[0], end[1] - start[1]),
      count = Math.max(1, Math.ceil(length / 0.8)),
      normal = [(end[1] - start[1]) / length, -(end[0] - start[0]) / length];
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count,
        x = start[0] * (1 - t) + end[0] * t,
        z = start[1] * (1 - t) + end[1] * t,
        y = ground(x, z);
      const a = [x + normal[0] * 0.12, y + 0.002, z + normal[1] * 0.12],
        b = [x - normal[0] * 0.12, y + 0.002, z - normal[1] * 0.12];
      footHeights.push(y);
      check(
        'existing physical low wall meets independent source ground',
        ray(a, b).length > 0 || ray(b, a).length > 0,
        { x, z, ground: y },
      );
    }
  }
  assert(footHeights.length > 500);
  allHeights.push(...footHeights);
  for (const [x, z] of [
    [-21, 20],
    [11, 20],
    [-5, -46],
  ])
    check(
      'garden remains open through all model levels',
      ray([x, 25, z], [x, -6, z]).length === 0,
      { x, z },
    );
  const galleryA = [-27.5, 2, 40],
    galleryB = [-30.3, 2, 40];
  if (d > 1)
    check('left courtyard arcade has actual passage air', ray(galleryA, galleryB).length === 0);
  else check('low detail gallery is an explicit solid proxy', ray(galleryA, galleryB).length > 0);
  const roofHit = ray([-36, 30, 0], [-36, 8, 0])[0];
  check('hipped roof has upward visible faces', !!roofHit && roofHit.point.y > 9);
  for (const x of [-12, -5, 2]) {
    check(
      'upper portico rear wall closes the photographic sky leak',
      ray([x, 9.45, -30.4], [x, 9.45, -27.5]).length > 0,
    );
    check(
      'white portico ceiling has a physical underside',
      ray([x, 9.6, -30], [x, 10.4, -30]).length > 0,
    );
    check(
      'low hip tiles do not cross the portico front',
      ray([x, 10, -32.1], [x, 8.5, -32.1]).length === 0,
    );
  }
  results.push({
    level: level.name,
    triangles,
    drawCalls: level.drawCalls,
    hash: level.hash,
    controls: checks.length,
    footProbes: footHeights.length,
    relativeGroundRange: [Math.min(...footHeights), Math.max(...footHeights)],
    failed: checks.filter((c) => !c.pass),
  });
}
const report = {
  status: failures.length ? 'failed' : 'passed',
  sourceHash: side.sourceHash,
  runtimeHash: side.hash,
  results,
  failures,
  terrainContact: {
    probes: results.reduce((n, r) => n + r.footProbes, 0),
    relativeGroundRange: [Math.min(...allHeights), Math.max(...allHeights)],
    source: 'Original DeltaDTM v1.1.1 one arcsecond pixels; existing320m source review',
    sourceGridHash: hashBytes(fs.readFileSync(new URL('terrain-grid.json', dir))),
    nativeFrameDryReferenceAndSourceGroundUnchanged: true,
    architectureRepair:
      'Photographic portico ceiling/backwall, roof notch and curved balusters; footing unchanged.',
  },
  scope:
    'Historic hotel entrance, courtyard wings and classical crosswing; later pool/service extension excluded. Sampled actual low wall contacts and three gardens;not surveyed floors or a measured global LOD error.',
};
console.log(JSON.stringify(report, null, 2));
assert.equal(failures.length, 0, 'Hotel Majapahit geometry controls failed');
